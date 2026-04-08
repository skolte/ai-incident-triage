import asyncio
import time
from typing import Optional

from langchain_core.tools import tool
from langchain_core.tracers.context import collect_runs
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from app.agents.base_agent import BaseAgent
from app.core.metrics import extract_token_usage, estimate_cost
from app.core.run_store import RunStore
from app.schemas.events import StreamEvent
from app.schemas.state import AgentState
from app.tools.log_tools import log_search_impl

SYSTEM_PROMPT = """
You are a LogAnalysisAgent — a specialist in operational log analysis.

Your job is to search incident logs, identify error patterns, correlate timestamps,
and produce a structured evidence summary. You do NOT produce the final incident ticket —
that is the TriageAgent's job. You gather raw evidence.

Rules:
1. Search logs aggressively — try multiple services, levels, and keywords.
2. Look for error spikes, repeated failures, and correlated timestamps.
3. Summarize your findings as a JSON object with these fields:
   - "services_affected": list of service names found in error logs
   - "error_patterns": list of distinct error messages or patterns observed
   - "log_entries_found": total number of matching log entries
   - "time_range": approximate time range of the errors (if visible)
   - "severity_indicators": list of signals suggesting severity (e.g., "15% error rate", "500 errors in 2 minutes")
   - "raw_evidence": list of up to 5 representative log lines (verbatim)
4. Return ONLY valid JSON — no markdown fences, no explanation text.
"""


class LogAnalysisAgent(BaseAgent):
    name = "LogAnalysisAgent"

    async def run(self, state: AgentState, store: RunStore) -> AgentState:
        print("LogAnalysisAgent: started")
        run_start = time.monotonic()

        await store.emit(
            StreamEvent(
                type="agent_started",
                run_id=state.run_id,
                agent=self.name,
                data={"message": "Starting log analysis — searching for error patterns"},
            )
        )

        tool_durations: list[dict] = []
        _tool_timer: list[float] = []

        def emit_tool_call(tool_name: str, args: dict) -> None:
            _tool_timer.append(time.monotonic())
            store.emit_sync(
                StreamEvent(
                    type="tool_call",
                    run_id=state.run_id,
                    agent=self.name,
                    data={"tool": tool_name, "args": args},
                )
            )

        def emit_tool_result(tool_name: str, result: str) -> None:
            duration_ms = int((time.monotonic() - _tool_timer.pop()) * 1000) if _tool_timer else 0
            tool_durations.append({"tool": tool_name, "duration_ms": duration_ms})
            store.emit_sync(
                StreamEvent(
                    type="tool_result",
                    run_id=state.run_id,
                    agent=self.name,
                    data={
                        "tool": tool_name,
                        "result_preview": result[:500],
                        "duration_ms": duration_ms,
                    },
                )
            )

        @tool
        def log_search(
            service: Optional[str] = None,
            contains: Optional[str] = None,
            level: Optional[str] = None,
        ) -> str:
            """Search incident logs by service name, message substring, and/or log level."""
            args = {"service": service, "contains": contains, "level": level}
            emit_tool_call("log_search", args)
            result = log_search_impl(service=service, contains=contains, level=level)
            emit_tool_result("log_search", result)
            return result

        await store.emit(StreamEvent(type="status", run_id=state.run_id, agent=self.name,
                                     data={"message": "Building log analysis agent with search tools"}))

        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        agent = create_react_agent(llm, [log_search], prompt=SYSTEM_PROMPT)

        await store.emit(StreamEvent(type="status", run_id=state.run_id, agent=self.name,
                                     data={"message": "Searching logs for error patterns and anomalies"}))

        loop = asyncio.get_running_loop()
        with collect_runs() as cb:
            result = await loop.run_in_executor(
                None,
                lambda: agent.invoke(
                    {"messages": [("human", f"Analyze logs for this incident:\n\n{state.incident_text}")]},
                    config={"run_name": "LogAnalysisAgent", "tags": ["incident-triage"]},
                ),
            )

        # Capture LangSmith run ID if available
        if cb.traced_runs:
            run_obj = cb.traced_runs[0]
            store.set_langsmith_run_id(state.run_id, str(run_obj.id))

        messages = result.get("messages", [])
        if messages:
            content = messages[-1].content if hasattr(messages[-1], "content") else str(messages[-1])
            state.tool_outputs["log_analysis"] = content
            state.evidence.append(f"[LogAnalysisAgent] {content[:800]}")

        latency_ms = int((time.monotonic() - run_start) * 1000)

        # Store per-agent metrics for supervisor aggregation
        token_usage = extract_token_usage(messages)
        state.tool_outputs["LogAnalysisAgent_metrics"] = {
            "prompt_tokens":     token_usage["prompt_tokens"],
            "completion_tokens": token_usage["completion_tokens"],
            "total_tokens":      token_usage["total_tokens"],
            "estimated_cost_usd": estimate_cost(token_usage["prompt_tokens"], token_usage["completion_tokens"]),
            "latency_ms":        latency_ms,
            "tool_count":        len(tool_durations),
            "tool_durations":    tool_durations,
        }

        await store.emit(
            StreamEvent(
                type="agent_completed",
                run_id=state.run_id,
                agent=self.name,
                data={
                    "message": "Log analysis complete",
                    "latency_ms": latency_ms,
                    "tools_used": len(tool_durations),
                },
            )
        )

        state.current_agent = self.name
        print(f"LogAnalysisAgent: completed in {latency_ms}ms")
        return state

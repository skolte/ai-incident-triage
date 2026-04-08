import asyncio
import json
import os
import time
from typing import Optional

from langchain_core.tools import tool
from langchain_core.tracers.context import collect_runs
from langchain_openai import ChatOpenAI
from langsmith import Client as LangSmithClient
from langgraph.prebuilt import create_react_agent

from app.agents.base_agent import BaseAgent
from app.core.metrics import extract_token_usage, estimate_cost
from app.core.run_store import RunStore
from app.schemas.events import StreamEvent
from app.schemas.incident import IncidentTicket
from app.schemas.state import AgentState
from app.tools.log_tools import log_search_impl
from app.tools.policy_tools import policy_check_impl
from app.tools.runbook_tools import list_runbooks_impl, read_runbook_impl

SYSTEM_PROMPT = """
You are a TriageAgent.

Your job is to analyze an ambiguous incident report, gather evidence using tools, and produce a valid IncidentTicket JSON object.

Rules:
1. Use tools before making conclusions.
2. Prefer log evidence and runbook guidance over guessing.
3. Include concrete evidence strings in the "evidence" field.
4. Include compliance flags if policy_check finds any.
5. Return only valid JSON matching the IncidentTicket schema.
6. Do not wrap the JSON in markdown fences.
7. Do not include any explanation before or after the JSON.
8. Do not invent impacted services that are not supported by evidence.
9. If logs do not confirm the issue, say so explicitly.
10. Use conservative severity unless evidence clearly supports SEV1.
11. Confidence must decrease when evidence is weak or indirect.

IncidentTicket schema:
{
  "title": "string",
  "severity": "SEV1|SEV2|SEV3|SEV4",
  "impacted_services": ["string"],
  "suspected_root_cause": "string",
  "evidence": ["string"],
  "mitigation_plan": ["string"],
  "customer_impact": "string",
  "compliance_flags": ["string"],
  "followup_questions": ["string"],
  "confidence": 0.0
}
"""

# Token extraction and cost calculation are in app.core.metrics (shared across agents)


class TriageAgent(BaseAgent):
    name = "TriageAgent"

    async def run(self, state: AgentState, store: RunStore) -> AgentState:
        print("TriageAgent: started")
        run_start = time.monotonic()

        await store.emit(
            StreamEvent(
                type="agent_started",
                run_id=state.run_id,
                agent=self.name,
                data={"message": "Starting triage analysis"},
            )
        )

        tool_durations: list[dict] = []
        # Use a list as a mutable closure variable (stack for nested safety)
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
            print("TriageAgent: log_search called", args)
            emit_tool_call("log_search", args)
            result = log_search_impl(service=service, contains=contains, level=level)
            emit_tool_result("log_search", result)
            return result

        @tool
        def list_runbooks() -> str:
            """List available incident response runbooks."""
            print("TriageAgent: list_runbooks called")
            emit_tool_call("list_runbooks", {})
            result = list_runbooks_impl()
            emit_tool_result("list_runbooks", result)
            return result

        @tool
        def read_runbook(filename: str) -> str:
            """Read a specific runbook by filename."""
            print("TriageAgent: read_runbook called", filename)
            emit_tool_call("read_runbook", {"filename": filename})
            result = read_runbook_impl(filename)
            emit_tool_result("read_runbook", result)
            return result

        @tool
        def policy_check(text: str) -> str:
            """Check text for compliance or governance flags."""
            print("TriageAgent: policy_check called")
            emit_tool_call("policy_check", {"text_preview": text[:200]})
            result = policy_check_impl(text)
            emit_tool_result("policy_check", result)
            return result

        print("TriageAgent: creating ChatOpenAI")
        await store.emit(StreamEvent(type="status", run_id=state.run_id, agent=self.name,
                                     data={"message": "Creating AI model (gpt-4o-mini)"}))
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        print("TriageAgent: creating LangGraph agent")
        await store.emit(StreamEvent(type="status", run_id=state.run_id, agent=self.name,
                                     data={"message": "Building LangGraph ReAct agent with tools"}))
        agent = create_react_agent(
            llm,
            [log_search, list_runbooks, read_runbook, policy_check],
            prompt=SYSTEM_PROMPT,
        )

        print("TriageAgent: invoking agent")
        await store.emit(StreamEvent(type="status", run_id=state.run_id, agent=self.name,
                                     data={"message": "Invoking agent — reasoning in progress"}))

        # Build the user message — include evidence from prior agents if available
        user_msg = state.incident_text
        if state.evidence:
            prior_evidence = "\n".join(state.evidence)
            user_msg = (
                f"{state.incident_text}\n\n"
                f"--- Prior agent findings ---\n{prior_evidence}"
            )

        # collect_runs() is a LangChain context manager that captures the IDs of
        # any LangSmith traces created inside the block. This lets us retrieve the
        # trace URL afterwards and surface it in the UI.
        langsmith_url: str | None = None
        loop = asyncio.get_running_loop()
        with collect_runs() as cb:
            result = await loop.run_in_executor(
                None,
                lambda: agent.invoke(
                    {"messages": [("user", user_msg)]},
                    config={
                        "run_name": "TriageAgent",
                        "tags": ["incident-triage"],
                        "metadata": {
                            "run_id": state.run_id,
                            "incident_preview": state.incident_text[:200],
                        },
                    },
                ),
            )

        # After invoke completes, try to fetch the LangSmith trace URL.
        # Only attempted when tracing is enabled; failures are non-fatal.
        if cb.traced_runs and os.getenv("LANGCHAIN_TRACING_V2") == "true":
            try:
                ls_client = LangSmithClient()
                ls_run = ls_client.read_run(str(cb.traced_runs[0]))
                langsmith_url = ls_run.url
                store.set_langsmith_run_id(state.run_id, str(ls_run.id))
                print(f"TriageAgent: LangSmith trace → {langsmith_url}")
            except Exception as ls_err:
                print(f"TriageAgent: could not fetch LangSmith URL: {ls_err}")

        messages = result.get("messages", [])
        if not messages:
            raise RuntimeError("Agent returned no messages.")

        content = messages[-1].content
        print("TriageAgent: raw output:", content)

        if not isinstance(content, str):
            raise RuntimeError(f"Expected string output, got: {type(content).__name__}")

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Agent output was not valid JSON. Raw output: {content}") from e

        try:
            ticket = IncidentTicket.model_validate(parsed)
        except Exception as e:
            raise RuntimeError(
                f"Agent output did not match IncidentTicket schema. Parsed output: {parsed}"
            ) from e

        state.final_result = ticket.model_dump()
        state.current_agent = self.name
        state.evidence = ticket.evidence
        state.compliance_flags = ticket.compliance_flags

        await store.emit(
            StreamEvent(
                type="agent_completed",
                run_id=state.run_id,
                agent=self.name,
                data={"message": "Triage completed"},
            )
        )

        # --- Observability metrics ---
        token_usage = extract_token_usage(messages)
        estimated_cost = estimate_cost(token_usage["prompt_tokens"], token_usage["completion_tokens"])
        total_latency_ms = int((time.monotonic() - run_start) * 1000)

        # Store per-agent metrics in state for supervisor aggregation
        state.tool_outputs["TriageAgent_metrics"] = {
            "prompt_tokens":     token_usage["prompt_tokens"],
            "completion_tokens": token_usage["completion_tokens"],
            "total_tokens":      token_usage["total_tokens"],
            "estimated_cost_usd": estimated_cost,
            "latency_ms":        total_latency_ms,
            "tool_count":        len(tool_durations),
            "tool_durations":    tool_durations,
            "langsmith_url":     langsmith_url,
        }

        # Emit per-agent metrics (used by SingleAgentOrchestrator;
        # SupervisorOrchestrator will emit aggregated metrics that override this)
        await store.emit(
            StreamEvent(
                type="metrics",
                run_id=state.run_id,
                agent=self.name,
                data=state.tool_outputs["TriageAgent_metrics"],
            )
        )

        print("TriageAgent: completed successfully")
        return state

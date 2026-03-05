import json
from typing import Optional

from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from app.agents.base_agent import BaseAgent
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


class TriageAgent(BaseAgent):
    name = "TriageAgent"

    async def run(self, state: AgentState, store: RunStore) -> AgentState:
        print("TriageAgent: started")

        await store.emit(
            StreamEvent(
                type="agent_started",
                run_id=state.run_id,
                agent=self.name,
                data={"message": "Starting triage analysis"},
            )
        )

        def emit_tool_call(tool_name: str, args: dict) -> None:
            store.emit_sync(
                StreamEvent(
                    type="tool_call",
                    run_id=state.run_id,
                    agent=self.name,
                    data={"tool": tool_name, "args": args},
                )
            )

        def emit_tool_result(tool_name: str, result: str) -> None:
            store.emit_sync(
                StreamEvent(
                    type="tool_result",
                    run_id=state.run_id,
                    agent=self.name,
                    data={
                        "tool": tool_name,
                        "result_preview": result[:500],
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
            args = {
                "service": service,
                "contains": contains,
                "level": level,
            }
            print("TriageAgent: log_search called", args)
            emit_tool_call("log_search", args)
            result = log_search_impl(
                service=service,
                contains=contains,
                level=level,
            )
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
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        print("TriageAgent: creating LangGraph agent")
        agent = create_react_agent(
            llm,
            [log_search, list_runbooks, read_runbook, policy_check],
            prompt=SYSTEM_PROMPT,
        )

        print("TriageAgent: invoking agent")
        result = agent.invoke({"messages": [("user", state.incident_text)]})

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

        print("TriageAgent: completed successfully")
        return state
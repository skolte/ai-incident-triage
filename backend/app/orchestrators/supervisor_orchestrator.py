from app.agents.compliance_agent import ComplianceAgent
from app.agents.log_analysis_agent import LogAnalysisAgent
from app.agents.triage_agent import TriageAgent
from app.core.run_store import RunStore
from app.schemas.events import StreamEvent
from app.schemas.state import AgentState


class SupervisorOrchestrator:
    """
    Multi-agent orchestrator that coordinates three specialist agents:

    1. LogAnalysisAgent  — searches logs, identifies error patterns and anomalies
    2. ComplianceAgent   — runs policy checks, consults runbooks for remediation
    3. TriageAgent       — synthesizes all evidence into a final IncidentTicket

    The supervisor routes agents sequentially, passing accumulated state (evidence,
    tool outputs, compliance flags) between them. Handoff events are emitted so the
    frontend can visualize the agent transitions in real time.
    """

    def __init__(self):
        self.log_analysis_agent = LogAnalysisAgent()
        self.compliance_agent = ComplianceAgent()
        self.triage_agent = TriageAgent()

    async def run(self, run_id: str, incident_text: str, store: RunStore):
        try:
            state = AgentState(
                run_id=run_id,
                incident_text=incident_text,
                current_agent=None,
            )

            await store.emit(StreamEvent(
                type="run_started",
                run_id=run_id,
                data={
                    "incident_text": incident_text,
                    "orchestrator": "SupervisorOrchestrator",
                    "agents": ["LogAnalysisAgent", "ComplianceAgent", "TriageAgent"],
                }
            ))

            # ── Phase 1: Log Analysis ────────────────────────────────
            await store.emit(StreamEvent(
                type="handoff",
                run_id=run_id,
                agent="Supervisor",
                data={
                    "to_agent": "LogAnalysisAgent",
                    "reason": "Gather log evidence and identify error patterns before triage",
                }
            ))

            state = await self.log_analysis_agent.run(state, store)

            # ── Phase 2: Compliance & Runbook Analysis ───────────────
            await store.emit(StreamEvent(
                type="handoff",
                run_id=run_id,
                agent="Supervisor",
                data={
                    "to_agent": "ComplianceAgent",
                    "reason": "Check compliance policies and consult runbooks with gathered evidence",
                }
            ))

            state = await self.compliance_agent.run(state, store)

            # ── Phase 3: Final Triage (synthesize into ticket) ───────
            await store.emit(StreamEvent(
                type="handoff",
                run_id=run_id,
                agent="Supervisor",
                data={
                    "to_agent": "TriageAgent",
                    "reason": "Synthesize all evidence into a structured IncidentTicket",
                }
            ))

            state = await self.triage_agent.run(state, store)

            # ── Aggregate metrics across all agents ──────────────────
            agent_names = ["LogAnalysisAgent", "ComplianceAgent", "TriageAgent"]
            total_prompt = 0
            total_completion = 0
            total_cost = 0.0
            total_latency = 0
            all_tool_durations: list = []
            total_tool_count = 0
            langsmith_url = None

            for name in agent_names:
                m = state.tool_outputs.get(f"{name}_metrics")
                if m:
                    total_prompt     += m.get("prompt_tokens", 0)
                    total_completion += m.get("completion_tokens", 0)
                    total_cost       += m.get("estimated_cost_usd", 0)
                    total_latency    += m.get("latency_ms", 0)
                    total_tool_count += m.get("tool_count", 0)
                    all_tool_durations.extend(m.get("tool_durations", []))
                    if m.get("langsmith_url"):
                        langsmith_url = m["langsmith_url"]

            await store.emit(StreamEvent(
                type="metrics",
                run_id=run_id,
                agent="Supervisor",
                data={
                    "prompt_tokens":      total_prompt,
                    "completion_tokens":  total_completion,
                    "total_tokens":       total_prompt + total_completion,
                    "estimated_cost_usd": round(total_cost, 6),
                    "latency_ms":         total_latency,
                    "tool_count":         total_tool_count,
                    "tool_durations":     all_tool_durations,
                    "langsmith_url":      langsmith_url,
                },
            ))

            # ── Emit final result ────────────────────────────────────
            await store.emit(StreamEvent(
                type="final_result",
                run_id=run_id,
                data={"ticket": state.final_result}
            ))

            await store.complete_run(run_id, state.final_result)
            await store.close_stream(run_id)

        except Exception as e:
            import traceback
            error_message = f"{type(e).__name__}: {str(e)}"
            traceback.print_exc()

            await store.emit(StreamEvent(
                type="error",
                run_id=run_id,
                data={"message": error_message}
            ))
            await store.close_stream(run_id)

from app.agents.triage_agent import TriageAgent
from app.core.run_store import RunStore
from app.schemas.events import StreamEvent
from app.schemas.state import AgentState


class SingleAgentOrchestrator:
    def __init__(self):
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
                data={"incident_text": incident_text}
            ))

            state = await self.triage_agent.run(state, store)

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
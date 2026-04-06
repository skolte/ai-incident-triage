import asyncio
from typing import Any, Dict, Optional

from app.schemas.events import StreamEvent


class RunStore:
    def __init__(self):
        self.runs: Dict[str, Dict[str, Any]] = {}
        self.queues: Dict[str, asyncio.Queue] = {}
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    def create_run(self, run_id: str, incident_text: str) -> None:         
        if self.loop is None:
            try:
                self.loop = asyncio.get_running_loop()
            except RuntimeError:
                self.loop = None

        self.runs[run_id] = {
            "langsmith_run_id": None,
            "sequence_counter": 0,
            "status": "running",
            "incident_text": incident_text,
            "events": [],
            "final_result": None,
        }
        self.queues[run_id] = asyncio.Queue()

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        return self.runs.get(run_id)

    def get_queue(self, run_id: str) -> Optional[asyncio.Queue]:
        return self.queues.get(run_id)

    async def emit(self, event: StreamEvent) -> None:
        if event.run_id not in self.runs:
            return
        self.runs[event.run_id]["sequence_counter"] += 1
        event.sequence = self.runs[event.run_id]["sequence_counter"]

        self.runs[event.run_id]["events"].append(event.model_dump())
        await self.queues[event.run_id].put(event)

    def emit_sync(self, event: StreamEvent) -> None:
        """
        Safe to call from synchronous tool functions.
        """
        if self.loop is None:
            raise RuntimeError("RunStore loop is not initialized.")

        asyncio.run_coroutine_threadsafe(self.emit(event), self.loop)

    async def complete_run(self, run_id: str, final_result: Dict[str, Any]) -> None:
        if run_id not in self.runs:
            return
        self.runs[run_id]["status"] = "completed"
        self.runs[run_id]["final_result"] = final_result
    
    def set_langsmith_run_id(self, run_id: str, langsmith_run_id: str) -> None:
        if run_id in self.runs:
            self.runs[run_id]["langsmith_run_id"] = langsmith_run_id

    async def close_stream(self, run_id: str) -> None:
        if run_id in self.queues:
            await self.queues[run_id].put(None)
# This is the main application file for the Triage backend service. 
# It sets up the FastAPI application, defines the API endpoints for starting a triage process, 
# retrieving the status of a run, and streaming real-time updates to the client.
import asyncio
import uuid
import os
import uuid
from langsmith import Client as LangSmithClient
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.core.run_store import RunStore
from app.core.sse import format_sse, format_heartbeat
from app.orchestrators.single_agent_orchestrator import SingleAgentOrchestrator
from app.schemas.api import TriageRequest, TriageStartResponse
from app.schemas.events import StreamEvent

load_dotenv()
ls_client = LangSmithClient()

# The FastAPI application is initialized, along with the RunStore for managing the state of runs and the SingleAgentOrchestrator for processing incidents with a single agent.
app = FastAPI()
store = RunStore()
orchestrator = SingleAgentOrchestrator()

origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in origins_env.split(",") if o.strip()]

if not allowed_origins:
    allowed_origins = [
        "http://localhost:5173",
        "https://main.dlvx8idi4h2r9.amplifyapp.com",
    ]

# CORS middleware is added to allow cross-origin requests from the React frontend, which will be hosted on a different domain or port.
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# A simple health check endpoint is defined to verify that the backend service is running and responsive.
@app.get("/health")
async def health():
    return {"status": "ok"}
    
@app.get("/healthz")
def healthz():
    return {"status": "ok"}

# The /api/triage endpoint is defined to start a new triage process. It generates a unique run_id, creates a new run in the RunStore, 
# and starts the orchestrator in a background task to process the incident text.
@app.post("/api/triage", response_model=TriageStartResponse)
async def start_triage(req: TriageRequest):
    run_id = str(uuid.uuid4())
    store.create_run(run_id, req.incident_text)
    
    async def run_with_debug():
        try:
            await orchestrator.run(run_id, req.incident_text, store)
        except Exception as e:
            print(f"[ERROR] orchestrator failed for {run_id}: {e}")
            raise

    asyncio.create_task(run_with_debug())
    return TriageStartResponse(run_id=run_id)

# The /api/triage/{run_id} endpoint allows clients to retrieve the current status and details of a specific run by its run_id.
@app.get("/api/triage/{run_id}")
async def get_run(run_id: str):
    run = store.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run

# The /api/triage/{run_id}/trace endpoint allows clients to retrieve the LangSmith trace for a specific run by its run_id.
@app.get("/api/triage/{run_id}/trace")
async def get_run_trace(run_id: str):
    run = store.get_run(run_id)
    if not run:    
        raise HTTPException(status_code=404, detail="Run not found")
    if run["langsmith_run_id"] is None:
        raise HTTPException(status_code=404, detail="LangSmith trace not yet available")
    else:        
        runs = list(ls_client.list_runs(                                                                                                                                                          
                                        project_name="ai-incident-triage",                    
                                        trace_id=run["langsmith_run_id"],   # fetches ALL runs in that trace by langsmith_run_id,                                                                                                                                                           
                                        select=["id", "name", "run_type", "status", "start_time", "end_time",                                                                                                              
                                                "prompt_tokens", "completion_tokens", "inputs", "outputs", "error"] 
                                    ))   
        # The runs are returned as a dictionary keyed by run ID, containing details about each run in the trace.
        # This allows the frontend to display the full trace of the triage process, including all steps taken by the orchestrator and agents.
        runs_dict = {
            str(r.id): {
                "id": str(r.id),
                "name": r.name,
                "run_type": r.run_type,
                "status": r.status,
                "start_time": r.start_time.isoformat() if r.start_time else None,
                "end_time": r.end_time.isoformat() if r.end_time else None,
                "prompt_tokens": r.prompt_tokens,
                "completion_tokens": r.completion_tokens,
                "total_tokens": r.total_tokens,
                "inputs": r.inputs,
                "outputs": r.outputs,
                "error": r.error,
            }
            for r in runs
        }
    return {"runs": runs_dict}

# The /api/triage/stream/{run_id} endpoint provides a Server-Sent Events (SSE) stream for real-time updates about the progress of a specific run.
# It retrieves the event queue for the run and yields events as they are emitted by the orchestrator and agents,
# allowing the React frontend to display live updates about the triage process.
@app.get("/api/triage/stream/{run_id}")
async def stream_run(run_id: str):
    queue = store.get_queue(run_id)
    if queue is None:
        raise HTTPException(status_code=404, detail="Run not found")

    # The event_generator function is defined to continuously yield events from the queue as they are emitted.
    # It uses a timeout to periodically send heartbeat messages if no events are received, ensuring that the connection remains alive.
    async def event_generator():
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15)
                if event is None:
                    break
                yield format_sse(event)
            except asyncio.TimeoutError:
                yield format_heartbeat()

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=headers,
    )
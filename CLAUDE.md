# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered incident triage system that uses a LangGraph ReAct agent with tools to analyze incident reports and produce structured `IncidentTicket` objects, streamed in real-time to a React frontend via Server-Sent Events (SSE).

I built a full-stack agentic AI system that analyzes operational incidents and produces structured remediation plans.
The backend uses FastAPI and LangGraph to orchestrate a tool-calling LLM agent that gathers evidence from logs and runbooks before generating structured outputs.
I implemented real-time execution telemetry using Server-Sent Events so the frontend can visualize each step of the agent's reasoning process.
The entire system is containerized with Docker and deployed to AWS ECS Fargate behind an Application Load Balancer using CloudFormation infrastructure-as-code.

## Technologies

Technologies

Python
FastAPI
LangGraph
LangChain
OpenAI API
React
Vite
TypeScript
Server-Sent Events (SSE)

Docker
AWS ECS Fargate
AWS ECR
AWS Application Load Balancer
AWS CloudFormation
AWS CloudWatch

Pydantic
REST APIs
Infrastructure as Code

## AWS Full Architecture Overview
User
  ↓
CloudFront CDN
  ↓
Amplify (React frontend)
  ↓
Application Load Balancer
  ↓
Target Group
  ↓
ECS Service
  ↓
ECS Task (Fargate)
  ↓
Docker Container
  ↓
FastAPI + LangGraph Agent

## Development Commands

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.app:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build to frontend/dist
npm run lint       # ESLint
```

## Environment Variables

**Backend (`.env` in repo root or `backend/`):**
```
OPENAI_API_KEY=sk-...
LANGCHAIN_TRACING_V2=true          # optional
LANGCHAIN_API_KEY=ls-...           # optional
LANGCHAIN_PROJECT=ai-incident-triage
ALLOWED_ORIGINS=http://localhost:5173,https://...
```

**Frontend (`.env` in `frontend/`):**
```
VITE_API_BASE_URL=http://localhost:8000
```

## Architecture

### Request Flow

```
User submits incident text (React form)
  → POST /api/triage  (creates run_id, starts background task)
  → SingleAgentOrchestrator.run()
  → TriageAgent (LangGraph ReAct, gpt-4o-mini)
      → tools: log_search, list_runbooks, read_runbook, policy_check
  → Produces IncidentTicket JSON
  → Events pushed via SSE to frontend in real-time
  → Frontend renders TracePanel + TicketViewer + ObservabilityPanel
```

### Backend Layers

| Layer | Files | Responsibility |
|-------|-------|----------------|
| API | `app/app.py` | 6 FastAPI endpoints, CORS, background tasks |
| Orchestration | `app/orchestrators/single_agent_orchestrator.py` | Lifecycle: `run_started` → `agent_started` → `final_result` |
| Agent | `app/agents/triage_agent.py` + `base_agent.py` | LangGraph ReAct agent, tool definitions, schema validation |
| Tools | `app/tools/` | `log_tools.py` (search logs.jsonl), `runbook_tools.py` (markdown runbooks), `policy_tools.py` (compliance checks) |
| Infrastructure | `app/core/run_store.py` + `sse.py` | In-memory run state + async event queues, SSE formatting |
| Schemas | `app/schemas/` | `IncidentTicket`, `AgentState`, `StreamEvent` Pydantic models |

### SSE Event Types

Events flow from backend → frontend in sequence: `run_started` → `agent_started` → `tool_call` / `tool_result` (repeating) → `agent_completed` → `metrics` → `final_result` (or `error`). `heartbeat` events keep the connection alive.

### Key API Endpoints

- `POST /api/triage` — Start a triage run, returns `{run_id}`
- `GET /api/triage/stream/{run_id}` — SSE stream of events
- `GET /api/triage/{run_id}` — Final run result
- `GET /api/triage/{run_id}/trace` — LangSmith trace URL
- `GET /health` or `/healthz` — Health check

### RunStore Pattern

`RunStore` (singleton in `app/core/run_store.py`) manages all active runs in memory. It holds an `asyncio.Queue` per run. The agent emits events via `emit_sync()` (thread-safe, for tool callbacks) or `emit()` (async). The SSE endpoint consumes from this queue.

### Adding a New Tool

1. Define the tool function in `app/tools/` using `@tool` decorator (LangChain)
2. Import and add it to `TriageAgent._build_tools()` in `app/agents/triage_agent.py`
3. The agent will automatically discover and use it

### Adding a New Agent / Orchestrator

- Extend `BaseAgent` (`app/agents/base_agent.py`) — implement `run(state, run_store)`
- Extend the supervisor placeholder (`app/orchestrators/supervisor_orchestrator.py`) for multi-agent workflows

## Deployment

- **Frontend**: AWS Amplify (build config in `amplify.yml`), publishes `frontend/dist`
- **Backend**: ECS Fargate via `backend/Dockerfile` (Python 3.11-slim), CloudFormation in `backend/ai-incident-full-stack.yaml`
- **No tests exist** in this codebase currently

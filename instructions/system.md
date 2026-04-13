# AI Incident Triage System — Master Reference Document

> **Maintained automatically.** Run the `/update-system-doc` agent after every significant feature addition or bug fix.
> Last updated: 2026-04-13

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
   - [Technology Choices Rationale](#technology-choices-rationale)
   - [AWS Infrastructure: Multi-Zone High-Availability Architecture](#aws-infrastructure-multi-zone-high-availability-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [AWS Infrastructure: Resource Inventory](#aws-infrastructure-resource-inventory)
7. [Implemented Features](#implemented-features)
8. [Key Design Decisions](#key-design-decisions)
9. [Bugs & Issues Fixed](#bugs--issues-fixed)
10. [Future Roadmap](#future-roadmap)
11. [Development Commands](#development-commands)
12. [Environment Variables](#environment-variables)

---

## Project Overview

An **AI-powered incident triage system** built to demonstrate modern agentic AI architecture patterns at production scale.

The system accepts ambiguous incident reports (service failures, error spikes, operational alerts), analyzes them using an LLM-powered ReAct agent, gathers evidence from operational tools, and produces a **structured `IncidentTicket`** with severity, root cause, evidence, mitigation plan, and compliance flags.

Unlike traditional AI chat interfaces, the system exposes the internal agent reasoning process through **real-time streaming observability** — every tool call, result, and reasoning step is streamed to the UI as it happens.

**Built to learn and demonstrate:**
- Agent orchestration with LangGraph
- Tool-calling LLM systems (ReAct pattern)
- Real-time AI observability via SSE
- Full-stack AI application design
- Cloud deployment on AWS ECS Fargate
- LangSmith tracing and evaluation

---

## Architecture Overview

```
User (Browser)
   │
   ▼
React + Vite (AWS Amplify)
   │  POST /api/triage      ← start run, get run_id
   │  GET  /api/triage/stream/{run_id}  ← SSE stream of events
   │  GET  /api/triage/{run_id}/trace   ← LangSmith trace data
   ▼
CloudFront CDN (HTTPS)
   │
   ▼
Application Load Balancer
   │
   ▼
ECS Fargate Container
   │
   ▼
FastAPI (app.py)
   │  creates run_id + asyncio.Queue
   │  starts background task
   ▼
SupervisorOrchestrator
   │  emits: run_started (lists all 3 agents)
   │
   ├─▶ handoff → LogAnalysisAgent (LangGraph ReAct)
   │      │  emits: agent_started, status, tool_call, tool_result, agent_completed
   │      └── log_search(service, contains, level)    → searches logs.jsonl
   │      stores evidence + tool_outputs in AgentState
   │
   ├─▶ handoff → ComplianceAgent (LangGraph ReAct)
   │      │  emits: agent_started, status, tool_call, tool_result, agent_completed
   │      ├── policy_check(text)                      → keyword compliance scan
   │      ├── list_runbooks()                         → lists markdown runbooks
   │      └── read_runbook(filename)                  → reads runbook content
   │      receives LogAnalysisAgent evidence, stores compliance findings in AgentState
   │
   └─▶ handoff → TriageAgent (LangGraph ReAct)
          │  emits: agent_started, status, tool_call, tool_result, agent_completed, metrics
          ├── log_search, list_runbooks, read_runbook, policy_check (all 4 tools)
          └── receives all prior agent evidence in prompt
          │
          ▼
   IncidentTicket (Pydantic schema validation)
   │
   ▼
final_result event → SSE → React frontend
```

### Request Lifecycle

```
POST /api/triage
  → run_id = uuid4()
  → RunStore.create_run(run_id)         # allocates asyncio.Queue
  → asyncio.create_task(SupervisorOrchestrator.run(...))
  → returns {run_id} immediately

GET /api/triage/stream/{run_id}
  → StreamingResponse(event_generator())
  → event_generator() reads from asyncio.Queue with 15s timeout
  → heartbeat emitted on timeout to keep connection alive
  → None sentinel on queue signals stream end
```

---

## Technology Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build tool | Vite |
| Language | TypeScript |
| Streaming | Server-Sent Events (SSE) |
| Styling | CSS custom properties (dark theme) |

### Backend
| Layer | Technology |
|---|---|
| API framework | FastAPI (Python) |
| Agent runtime | LangGraph (`create_react_agent`) |
| LLM integration | LangChain + `langchain-openai` |
| LLM model | `gpt-4o-mini` (temp=0) |
| Tracing | LangSmith (`langchain_core.tracers.context.collect_runs`) |
| Schema validation | Pydantic v2 |
| Async execution | `asyncio` + `run_in_executor` for sync agent.invoke |
| Environment | `python-dotenv` |

### Infrastructure
| Component | Service |
|---|---|
| Frontend hosting | AWS Amplify |
| CDN / HTTPS | Amazon CloudFront |
| Load balancing | Application Load Balancer (ALB) |
| Container orchestration | Amazon ECS (Elastic Container Service) |
| Compute | AWS Fargate (serverless containers) |
| Container registry | Amazon ECR |
| Infrastructure as code | AWS CloudFormation (`backend/ai-incident-full-stack.yaml`) |
| Logging | Amazon CloudWatch |
| Networking | VPC, Subnets, Security Groups |

### Technology Choices Rationale

#### Why FastAPI for the API Layer?

**Real-Time SSE Streaming**
- The system streams agent execution events to the frontend in real-time via Server-Sent Events (SSE). FastAPI's native async/await support makes it straightforward to manage long-lived streaming connections and emit events as the agent executes.

**Async-Native Architecture**
- FastAPI is built on `asyncio`, which is essential for:
  - Handling multiple concurrent SSE connections (different users running their own triage sessions simultaneously)
  - Non-blocking I/O when tools make external API calls (log search, policy checks, runbook reads)
  - Managing the `asyncio.Queue` per run without blocking the event loop

**Background Task Execution**
- When a triage request arrives (`POST /api/triage`), we immediately return a `run_id` and spawn a background orchestration task that runs asynchronously. FastAPI's `asyncio.create_task()` integration makes this clean and reliable.

**Type Safety & Validation**
- FastAPI integrates seamlessly with Pydantic, which we already use for schemas. Request/response bodies are automatically validated against `TriageRequest` and `TriageStartResponse` schemas.

**High Performance**
- FastAPI is one of the fastest Python web frameworks, with sub-millisecond overhead. For a system handling real-time events and concurrent connections, this matters.

#### Agent Orchestration Patterns: Single Agent vs. Sequential Supervisor

**Pattern Overview:**

1. **Single Agent Pattern** (current primary)
   - One `TriageAgent` handles the entire incident analysis end-to-end
   - Calls tools (`log_search`, `policy_check`, `list_runbooks`, `read_runbook`) to gather evidence
   - Produces the final `IncidentTicket` directly
   - Pros: Simple, deterministic, fewer moving parts
   - Cons: Single agent becomes complex if it needs to handle very specialized tasks

2. **Sequential Supervisor Pattern** (available alternative)
   - Three specialist agents run in sequence: `LogAnalysisAgent` → `ComplianceAgent` → `TriageAgent`
   - Each agent receives accumulated evidence from prior agents via shared `AgentState`
   - Supervisor orchestrates handoffs and aggregates metrics
   - Pros: Modular (add new agents without touching existing ones), separation of concerns, easier to extend
   - Cons: More orchestration complexity, data dependencies must be managed explicitly

**Why Sequential Over Parallel?**
- LogAnalysisAgent findings inform ComplianceAgent's runbook selection
- ComplianceAgent compliance flags inform TriageAgent's severity assessment
- These data dependencies make sequential execution with shared state simpler than parallel fan-out with merge logic

**Why This System Supports Both:**
- The system is designed to learn orchestration patterns. Both `SingleAgentOrchestrator` and `SupervisorOrchestrator` are implemented
- For future scaling (RAG agent, approval agent, review agent), the supervisor pattern provides the infrastructure
- Currently using `SingleAgentOrchestrator` for simplicity; switch to `SupervisorOrchestrator` in `app.py` to enable multi-agent workflow

#### Why CloudFront CDN with HTTPS Termination?

**Performance via Edge Caching**
- The React frontend (static HTML, JS, CSS) is cached at CloudFront edge locations globally
- Users download content from the geographically nearest edge location rather than the origin
- Dramatically reduces latency for international users and high-traffic scenarios

**HTTPS Termination (SSL/TLS Offloading)**
- CloudFront handles all HTTPS encryption/decryption at the edge
- Browsers establish TLS connections to CloudFront's edge servers, not directly to the backend
- Reduces CPU overhead on Amplify and the ALB (they receive unencrypted traffic from CloudFront, encrypted from users)
- Centralized certificate management — one certificate at CloudFront instead of per-origin

**Security & DDoS Protection**
- **Origin Hiding**: Only CloudFront's IP addresses are publicly visible; backend IPs remain hidden
- **AWS Shield Standard**: Built-in DDoS protection at the edge, absorbing volumetric attacks before they reach the origin
- **Reduced Attack Surface**: Backend is only reachable through CloudFront, not directly from the internet
- **WAF Integration**: Can attach AWS WAF rules to CloudFront for sophisticated request filtering (rate limiting, geo-blocking, custom rules)

**Cost Efficiency**
- Caching static assets dramatically reduces the number of requests reaching Amplify and the ALB
- Fewer origin requests = lower data transfer and compute costs
- CloudFront data transfer is often cheaper than origin-to-user data transfer

---

## AWS Infrastructure: Multi-Zone High-Availability Architecture

### Reliability Through Geographic Distribution

#### Why Multiple Availability Zones (Multi-AZ)?

**Fault Tolerance**
- Each ECS task runs in either AZ-a or AZ-b (geographically separate datacenters within the region)
- If an entire AZ fails (power outage, hardware failure, network partition), the other AZ continues serving traffic
- The ALB automatically detects failed tasks via health checks and routes all traffic to the healthy AZ

**Zero-Downtime Deployments**
- When rolling out a new container image, the ECS Service spins up new tasks in healthy AZs while gracefully terminating old ones
- Users never experience complete outage; traffic seamlessly shifts between task generations

**High Availability (HA) for SLA Compliance**
- Multi-AZ deployment is industry standard for production workloads
- Achieves "four nines" uptime (99.99%) when properly configured

#### Why Application Load Balancer (ALB)?

**Layer 7 (Application-Layer) Intelligence**
- Unlike a classic Load Balancer (Layer 4), the ALB understands HTTP/HTTPS, hostnames, paths
- Can route `/api/triage` differently from static assets (though currently not used, it's available for future API versioning)
- Handles HTTP → HTTPS upgrades and custom header injection if needed

**Health Checking**
- ALB continuously probes the `/healthz` endpoint on each ECS task (10s interval)
- If a task fails the health check, the ALB removes it from the rotation within seconds
- Only healthy tasks receive traffic

**Connection Management**
- Terminates long-lived client connections (SSE streams) and creates new ones to backend tasks
- 300-second idle timeout prevents hanging connections from consuming resources indefinitely

#### Why Target Group?

**Decoupling Load Balancer from Compute**
- The Target Group is a logical grouping of backend resources (ECS tasks)
- The ALB doesn't need to know about individual tasks; it just forwards to the Target Group
- When ECS scales (spins up/down tasks), the Target Group automatically registers/deregisters them
- The ALB routing logic doesn't need to change

**Health Check Configuration**
- Target Group defines health check parameters: endpoint (`/healthz`), HTTP 200 expected, 10s interval
- Failed tasks are immediately marked unhealthy and removed from rotation
- Automatic recovery: ECS Service detects the unhealthy task and launches a replacement

#### Why ECS Fargate (Serverless Containers)?

**Zero Infrastructure Management**
- No EC2 instances to patch, monitor, or scale manually
- AWS manages the underlying hardware, OS, Docker runtime
- You declare desired CPU/memory per task (e.g., 512 vCPU, 1024 MB RAM); Fargate allocates and manages infrastructure

**Cost Efficiency**
- Pay per task-second of execution, not per instance/hour
- No waste on idle capacity; scale to zero if needed
- Automatic bin-packing across AZs (AWS optimizes placement)

**Compliance & Security**
- Each task runs in a fully isolated Linux container (cgroup/namespace isolation)
- No shared tenancy with other customers (different from EC2 Spot)
- CloudWatch logs automatically captured

#### Why Docker Containers?

**Reproducibility**
- The same `Dockerfile` produces identical images whether built on dev machine, CI/CD, or production
- "Works on my machine" → guaranteed to work in production (same OS, libraries, Python runtime)

**Portability**
- Push the image to Amazon ECR (Elastic Container Registry)
- Deploy the same image to dev (local Docker), staging (ECS Fargate), production (ECS Fargate)
- No dependency on specific infrastructure (swap ECR for DockerHub, ECS for Kubernetes, zero code changes needed)

**Resource Isolation & Efficiency**
- Each container gets its own isolated filesystem, environment variables, and process space
- Multiple containers run on a single Fargate task (if needed) or across tasks in different AZs
- Much lighter than VMs (seconds to start vs. minutes), cheaper than EC2

**Supply Chain & Security**
- Scan images with Amazon ECR scanning for CVEs before deployment
- Image immutability: once pushed, an image cannot be modified (only tagged with a new version)
- Clear audit trail: every deployed image has a commit SHA and build timestamp

---

## Backend Architecture

### Layer Map

```
backend/app/
├── app.py                              ← FastAPI app, 6 endpoints, CORS, background tasks
├── orchestrators/
│   ├── single_agent_orchestrator.py   ← run_started → agent → final_result lifecycle (legacy)
│   └── supervisor_orchestrator.py     ← Multi-agent: LogAnalysis → Compliance → Triage with handoffs
├── agents/
│   ├── base_agent.py                  ← Abstract BaseAgent (run interface)
│   ├── log_analysis_agent.py          ← LogAnalysisAgent: log_search tool, error pattern identification
│   ├── compliance_agent.py            ← ComplianceAgent: policy_check + runbook tools, compliance flags
│   └── triage_agent.py                ← TriageAgent: all 4 tools, synthesizes prior evidence into IncidentTicket
├── tools/
│   ├── log_tools.py                   ← log_search_impl: reads logs.jsonl (up to 10 matches)
│   ├── runbook_tools.py               ← list_runbooks_impl, read_runbook_impl (markdown files)
│   └── policy_tools.py                ← policy_check_impl: keyword-based compliance flags
├── core/
│   ├── run_store.py                   ← In-memory run state + asyncio.Queue per run
│   └── sse.py                         ← format_sse(), format_heartbeat() formatters
├── schemas/
│   ├── incident.py                    ← IncidentTicket Pydantic model
│   ├── events.py                      ← StreamEvent model (11 event types)
│   ├── state.py                       ← AgentState (carries run_id, incident_text, results)
│   └── api.py                         ← TriageRequest, TriageStartResponse
└── data/
    ├── logs.jsonl                      ← Sample log data (JSONL format)
    ├── logs_extended.jsonl             ← Extended sample log data
    └── runbooks/
        ├── 500_errors.md
        ├── auth_failures.md
        └── db_latency.md
```

### API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/triage` | Start a triage run. Returns `{run_id}`. |
| GET | `/api/triage/stream/{run_id}` | SSE stream of all run events. |
| GET | `/api/triage/{run_id}` | Full run state (status, events, final_result). |
| GET | `/api/triage/{run_id}/trace` | LangSmith trace data for the run. |
| GET | `/health` | Health check (async). |
| GET | `/healthz` | Health check (sync, for ALB). |

### SSE Event Types

Events flow in this sequence per run:

```
run_started → [handoff → agent_started → [status]* → [tool_call → tool_result]* → agent_completed]×3 → metrics → final_result
                                                                                                               (or error)
```

| Event | Emitter | Key Data |
|---|---|---|
| `run_started` | SupervisorOrchestrator | `incident_text`, `orchestrator`, `agents` (list of 3 agent names) |
| `handoff` | SupervisorOrchestrator | `to_agent`, `reason` (emitted before each agent starts) |
| `agent_started` | Each agent | `message` |
| `status` | Each agent | `message` (step-by-step progress) |
| `tool_call` | Each agent's tool wrapper | `tool`, `args` |
| `tool_result` | Each agent's tool wrapper | `tool`, `result_preview`, `duration_ms` |
| `agent_completed` | Each agent | `message`, `latency_ms`, `tools_used` |
| `metrics` | TriageAgent | `prompt_tokens`, `completion_tokens`, `total_tokens`, `estimated_cost_usd`, `latency_ms`, `tool_count`, `tool_durations`, `langsmith_url` |
| `final_result` | SupervisorOrchestrator | `ticket` (full IncidentTicket JSON) |
| `error` | SupervisorOrchestrator (catch) | `message` |
| `heartbeat` | SSE endpoint | (keepalive, every 15s timeout) |

### IncidentTicket Schema

```json
{
  "title": "string",
  "severity": "SEV1 | SEV2 | SEV3 | SEV4",
  "impacted_services": ["string"],
  "suspected_root_cause": "string",
  "evidence": ["string"],
  "mitigation_plan": ["string"],
  "customer_impact": "string",
  "compliance_flags": ["string"],
  "followup_questions": ["string"],
  "confidence": 0.0
}
```

### Tools

| Tool | Implementation | Behavior |
|---|---|---|
| `log_search(service, contains, level)` | `log_tools.py` | Reads `logs.jsonl`, filters by service/message/level, returns up to 10 matches as JSONL |
| `list_runbooks()` | `runbook_tools.py` | Returns list of `.md` filenames in `data/runbooks/` |
| `read_runbook(filename)` | `runbook_tools.py` | Reads and returns markdown content of a specific runbook |
| `policy_check(text)` | `policy_tools.py` | Keyword scan: `user_id` → `possible_pii_in_evidence`, `payment` → `regulated_domain_attention`, `data leak`/`exfil` → `potential_data_exfiltration` |

### RunStore Pattern

`RunStore` (singleton) manages all active runs in memory:
- One `asyncio.Queue` per run for event delivery
- Captures the asyncio event loop on first run (for `emit_sync()` thread safety)
- `emit()` — async, used from async context (orchestrator, agent)
- `emit_sync()` — synchronous, used from tool callbacks (which run in executor threads); uses `asyncio.run_coroutine_threadsafe()`
- `None` sentinel in the queue signals stream completion to the SSE endpoint

### Agent System Prompt Rules

**LogAnalysisAgent** system prompt enforces:
1. Search logs aggressively across multiple services, levels, and keywords
2. Look for error spikes, repeated failures, and correlated timestamps
3. Return structured JSON with: `services_affected`, `error_patterns`, `log_entries_found`, `time_range`, `severity_indicators`, `raw_evidence`
4. Return only valid JSON — no markdown fences

**ComplianceAgent** system prompt enforces:
1. Always run `policy_check` on incident text and evidence
2. List and read relevant runbooks for affected services
3. Return structured JSON with: `compliance_flags`, `compliance_details`, `runbooks_consulted`, `remediation_steps`, `risk_level`
4. Return only valid JSON — no markdown fences

**TriageAgent** system prompt enforces:
1. Use tools before making conclusions
2. Prefer log evidence and runbook guidance over guessing
3. Include concrete evidence strings in the `evidence` field
4. Include compliance flags if `policy_check` finds any
5. Return **only** valid JSON — no markdown fences, no preamble
6. Do not invent impacted services without evidence
7. Use conservative severity unless evidence clearly supports SEV1
8. Confidence must decrease when evidence is weak
9. When prior agent evidence is available, incorporate it into reasoning

---

## Frontend Architecture

```
frontend/src/
├── App.tsx                         ← Root: state management, SSE orchestration, tabbed landing page
├── api.ts                          ← startTriage(), connectToRunStream(), getTrace()
├── index.css                       ← Global styles (includes architecture panel + tab switcher CSS)
├── App.css                         ← App-level dark theme, grid, component styles
└── components/
    ├── IncidentForm.tsx            ← Textarea + submit button
    ├── TracePanel.tsx              ← Live event stream, tool call timeline
    ├── TicketViewer.tsx            ← Structured ticket display (severity badge, sections)
    ├── PipelineViz.tsx             ← 3-agent pipeline visualization (Log Analysis → Compliance → Triage) with per-agent state
    ├── ObservabilityPanel.tsx      ← Token usage bar, cost, latency, tool performance chart
    ├── LangSmithTrace.tsx          ← Post-run LangSmith trace table (fetches from /trace)
    └── ArchitecturePanel.tsx       ← Interactive architecture reference (multi-agent diagrams, workflow, tech stack)
```

### UI Components

**App.tsx**
- Manages all state: `runId`, `events[]`, `ticket`, `isRunning`, `metrics`, `elapsed`, `statusMessage`, `landingTab`
- Landing page has a tabbed interface: "Live Demo" (original content) and "Architecture" (ArchitecturePanel)
- Drives the 5-step progress bar with step labels
- Live elapsed timer while running
- Error banner on failure
- Cleanup ref to cancel SSE connection on new run

**IncidentForm**
- Plain textarea for incident description
- Submit triggers `POST /api/triage` then SSE connection
- Disabled while run is in progress

**TracePanel**
- Renders each `StreamEvent` in chronological order
- Tool call events show tool name, args, result preview, duration
- Grouped visually by event type

**TicketViewer**
- Renders the `IncidentTicket` once `final_result` arrives
- Severity badge with color coding
- Expandable sections: evidence, mitigation plan, compliance flags, follow-up questions

**ObservabilityPanel**
- Appears after each completed run
- Token usage: stacked bar (prompt vs completion)
- Estimated cost in USD (gpt-4o-mini pricing)
- Total end-to-end latency
- Per-tool latency bar chart
- LangSmith trace link (external)

**LangSmithTrace**
- Fetches from `GET /api/triage/{run_id}/trace` after run completes
- Displays all LangSmith spans: run type badge, name, latency, token count
- Only renders when `LANGCHAIN_TRACING_V2=true`

**ArchitecturePanel**
- Displayed via the "Architecture" tab on the landing page
- Seven sections: system architecture diagram (node flow), agent workflow (6-step pipeline), real-time SSE protocol (9 event types with emitters), technology stack (4 categories), IncidentTicket schema, key design decisions (5 trade-offs), and backend layer map
- Fully static — no API calls, renders from inline data constants

### API Client (`api.ts`)

- `startTriage(text)` → `POST /api/triage`
- `connectToRunStream(runId, onEvent, onClose)` → opens `EventSource`, returns cleanup fn
- `getTrace(runId)` → `GET /api/triage/{run_id}/trace`, returns `Record<string, TraceRun>`

---

## AWS Infrastructure: Resource Inventory

Defined in `backend/ai-incident-full-stack.yaml` (CloudFormation). **19 resources total**, parameterized with `ContainerImage`, `OpenAIAPIKey`, `AllowedOrigins`, `ContainerPort` (default 8000), `Cpu` (default 512), `Memory` (default 1024), `DesiredCount` (default 1).

**For the design rationale behind these component choices (multi-AZ, ALB, Target Group, ECS Fargate, CloudFront HTTPS, Docker), see [AWS Infrastructure: Multi-Zone High-Availability Architecture](#aws-infrastructure-multi-zone-high-availability-architecture) in the Technology Choices Rationale section above.**

| Component | Role |
|---|---|
| VPC (10.20.0.0/16) | Isolated network with DNS support enabled |
| Internet Gateway | Public internet access for VPC subnets |
| Public Subnet A (10.20.1.0/24) | AZ-a, auto-assign public IP |
| Public Subnet B (10.20.2.0/24) | AZ-b, auto-assign public IP |
| Route Table + Default Route | 0.0.0.0/0 → Internet Gateway |
| ALB Security Group | Allows inbound TCP:80 from 0.0.0.0/0 |
| ECS Security Group | Allows inbound from ALB SG only on container port |
| Application Load Balancer | Internet-facing, 300s idle timeout |
| Target Group | IP target type, health check on `/healthz` (HTTP 200), 10s interval |
| HTTP Listener | Port 80, forwards to Target Group |
| ECS Cluster | `ai-incident-cluster` |
| ECS Task Definition | Fargate, 512 CPU / 1024 MB, x86_64 Linux, awsvpc networking |
| ECS Service | Desired count 1, 60s health check grace period, public IP enabled |
| AWS Fargate | Serverless compute (no EC2 management) |
| IAM Execution Role | ECS task execution + ECR pull + CloudWatch write |
| CloudWatch Log Group | `/ecs/ai-incident`, 14-day retention |
| Amazon ECR | Docker image registry |
| AWS Amplify | Frontend hosting (build from `amplify.yml`) |
| CloudFront | HTTPS + CDN for Amplify frontend |

---

## Implemented Features

### Core Pipeline
- [x] Single ReAct agent triage pipeline (LangGraph `create_react_agent`)
- [x] Four operational tools: `log_search`, `list_runbooks`, `read_runbook`, `policy_check`
- [x] Pydantic-validated `IncidentTicket` output (11 fields)
- [x] System prompt with strict JSON-only output enforcement
- [x] `gpt-4o-mini` model (temperature=0 for determinism)

### Multi-Agent Supervisor Architecture
- [x] SupervisorOrchestrator coordinates 3 sequential specialist agents with handoff events
- [x] LogAnalysisAgent: searches logs using `log_search`, identifies error patterns, timestamps, service failures; stores structured evidence in shared `AgentState`
- [x] ComplianceAgent: runs `policy_check`, `list_runbooks`, `read_runbook`; receives LogAnalysisAgent evidence; produces compliance flags and remediation steps
- [x] TriageAgent: receives all prior agent evidence in prompt context; synthesizes into final `IncidentTicket`
- [x] Shared `AgentState` carries `evidence`, `tool_outputs`, and `compliance_flags` between agents
- [x] `handoff` SSE events emitted between each agent transition for real-time UI visualization
- [x] PipelineViz component shows 3 agent nodes with individual state tracking
- [x] TracePanel enhanced to display agent names, handoff reasons, and orchestrator details

### Streaming & Observability
- [x] Real-time SSE streaming via `asyncio.Queue` per run
- [x] 11 event types with sequence numbers and timestamps
- [x] Heartbeat keepalive (15s timeout)
- [x] Tool call + result events with duration tracking
- [x] Token usage tracking (dual-path: new `usage_metadata` + legacy `response_metadata.token_usage`)
- [x] Estimated cost calculation (gpt-4o-mini pricing constants)
- [x] End-to-end latency measurement

### LangSmith Integration
- [x] `collect_runs()` context manager captures trace ID
- [x] `langsmith_url` surfaced in `metrics` event and ObservabilityPanel
- [x] `GET /api/triage/{run_id}/trace` endpoint fetches full trace from LangSmith API
- [x] LangSmith trace panel in UI (post-run, sorted by start time)

### Frontend UI
- [x] Dark-themed single-page app
- [x] 5-step progress bar with real-time step advancement
- [x] Live elapsed timer while running
- [x] Live backend status messages (status event → progress label)
- [x] ObservabilityPanel: token bar, cost, latency, per-tool chart
- [x] TicketViewer: severity badge, all ticket sections
- [x] TracePanel: chronological event stream with tool details
- [x] Error banner for backend failures
- [x] Tabbed landing page: "Live Demo" and "Architecture" tabs
- [x] ArchitecturePanel: interactive system reference with architecture diagram, agent workflow, SSE protocol, tech stack, schema, design decisions, and backend layer map

### Infrastructure
- [x] CORS configurable via `ALLOWED_ORIGINS` environment variable
- [x] `/health` (async) and `/healthz` (sync) for ALB health checks
- [x] Dockerfile (Python 3.11-slim)
- [x] CloudFormation full-stack template
- [x] Amplify CI/CD build configuration

---

## Key Design Decisions

### `asyncio.Queue` per run (not a global event bus)
**Why:** Clean per-run isolation. Each SSE connection reads only its own run's events. No risk of cross-run event leakage. Simple cleanup: drop the queue when the run ends.

### `emit_sync()` with `run_coroutine_threadsafe()`
**Why:** LangGraph's `agent.invoke()` is synchronous and runs in a thread pool executor. Tool callbacks are therefore synchronous. We cannot `await` inside them. `emit_sync` bridges the sync/async boundary safely using the captured event loop.

### `run_in_executor` for `agent.invoke()`
**Why:** `agent.invoke()` is a blocking call. Running it directly in an async FastAPI handler would block the event loop, starving all other coroutines (including SSE heartbeats). `loop.run_in_executor(None, lambda: agent.invoke(...))` moves it to a thread pool.

### `collect_runs()` for LangSmith trace ID capture
**Why:** LangSmith run IDs are generated during execution. `collect_runs()` is the clean LangChain-provided way to capture them without modifying the agent invocation signature.

### Dual-path token extraction
**Why:** LangChain changed the token usage API between versions. New builds use `usage_metadata` attribute; older `langchain-openai` versions put it in `response_metadata["token_usage"]`. The `_extract_token_usage()` function tries both, making the system resilient to version differences.

### System prompt: JSON-only, no markdown fences
**Why:** The output is parsed directly with `json.loads()`. Any wrapping (```json...```) breaks parsing. The prompt explicitly forbids fences and explanation text. Pydantic then validates the parsed dict against `IncidentTicket`.

### Sequential multi-agent pipeline (not parallel)
**Why:** The three agents have data dependencies: ComplianceAgent needs LogAnalysisAgent's evidence, and TriageAgent needs both. Sequential execution with shared `AgentState` is simpler and more deterministic than parallel fan-out with merge logic. Each agent's output is appended to `state.evidence` and `state.tool_outputs` for downstream consumption.

### Shared `AgentState` for inter-agent communication
**Why:** Rather than passing messages between agents via an LLM-mediated conversation, we use a structured Pydantic `AgentState` object with typed fields (`evidence`, `tool_outputs`, `compliance_flags`). This avoids token waste and ensures downstream agents receive complete, untruncated evidence.

### In-memory RunStore (no persistence)
**Why:** Intentional simplicity for the learning/demo scope. Runs are transient — they live for the duration of the server process. Persistence (DynamoDB, PostgreSQL) is a planned roadmap item.

---

## Bugs & Issues Fixed

### 1. CORS hardcoded origins blocked deployed frontend
**Symptom:** After deploying to AWS Amplify, the frontend at `*.amplifyapp.com` was blocked by CORS because only `localhost:5173` was whitelisted in the backend code.
**Fix:** Replaced hardcoded origins list with `ALLOWED_ORIGINS` environment variable (comma-separated). Falls back to defaults if env var is empty. Set in ECS task environment.
**Commit:** `be77d9a`

### 2. Amplify build not publishing frontend
**Symptom:** Amplify build succeeded but the app wasn't served — the `baseDirectory` in `amplify.yml` pointed to the wrong output path.
**Fix:** Updated `amplify.yml` to publish `frontend/dist` (Vite's default output directory).
**Commit:** `0f9ac4b`

### 3. `amplify.yml` in wrong location
**Symptom:** Amplify couldn't find the build config because `amplify.yml` was inside the `frontend/` subdirectory rather than the repo root.
**Fix:** Moved `amplify.yml` to repo root so Amplify auto-discovers it.
**Commit:** `3f640a6`

### 4. Token usage returning zero on newer LangChain versions
**Symptom:** ObservabilityPanel showed `0` tokens and `$0.00` cost despite the agent completing successfully.
**Root cause:** Newer `langchain-core` versions moved token counts to `message.usage_metadata` instead of `message.response_metadata["token_usage"]`. The original code only checked the latter.
**Fix:** `_extract_token_usage()` now checks `usage_metadata` first, falls through to `response_metadata["token_usage"]` as fallback.

### 5. SSE connection blocked on sync agent.invoke()
**Symptom:** While the agent was running, heartbeat events weren't being sent, causing SSE connections to drop after 15 seconds.
**Root cause:** `agent.invoke()` was blocking the asyncio event loop.
**Fix:** Wrapped `agent.invoke()` in `loop.run_in_executor(None, lambda: ...)` to move it off the event loop thread.

### 6. Tool callbacks couldn't emit SSE events
**Symptom:** `tool_call` and `tool_result` events were not appearing in the stream.
**Root cause:** Tool functions are synchronous (called from LangGraph's internal sync dispatch), but `RunStore.emit()` is a coroutine. Calling `await` inside a sync function raises `RuntimeError`.
**Fix:** Added `emit_sync()` to RunStore, which uses `asyncio.run_coroutine_threadsafe()` to submit the coroutine to the captured event loop from the sync tool context.

---

## Future Roadmap

### ~~Phase 1 — Multi-Agent Supervisor Architecture~~ COMPLETED (2026-04-07)

Moved to [Implemented Features > Multi-Agent Supervisor Architecture](#implemented-features).

### Phase 2 — Human-in-the-Loop Escalation

- For SEV1 incidents, agent pauses mid-execution and waits for human approval
- Uses LangGraph `interrupt()` mechanism
- UI shows "Approve / Reject" buttons on `awaiting_approval` event
- **Resume bullet:** Implemented human-in-the-loop checkpoints with LangGraph interrupts for high-severity escalation.

### Phase 3 — Episodic Memory / RAG

- Before triage starts, retrieve 3 most similar past incidents from a vector store
- Inject as context: "Similar incidents in the last 30 days: [...]"
- Demonstrates RAG + memory pattern central to production agentic systems
- **Resume bullet:** Integrated vector-based episodic memory enabling agents to reason over historical incident context.

### Phase 4 — Self-Reflection / Quality Loop

```
TriageAgent → draft ticket → ReviewAgent (scores confidence + completeness)
  → score < 0.7 → revise → final ticket
```

- **Resume bullet:** Implemented agent self-reflection and quality scoring with automated revision loops.

### Phase 5 — MCP Tool Layer

- Expose tools as MCP-compliant endpoints
- Enable agent-to-agent tool invocation
- **Resume bullet:** Built MCP-compliant agent tool registry enabling interoperable tool invocation.

### Phase 6 — Knowledge Graph Integration

- Neo4j-backed incident relationship graph
- Agent queries graph to reason over relationships (affected services, past similar causes)
- **Resume bullet:** Integrated vector search with graph database reasoning using Neo4j.

### Phase 7 — Observability & Persistence

- Store run history, event logs, and incident tickets (DynamoDB or PostgreSQL)
- Run dashboard with historical metrics
- Token usage trends, tool success rates

### Phase 8 — Voice Interface

- Pipeline: Voice → STT (Whisper) → Agent → TTS (ElevenLabs)
- **Resume bullet:** Implemented multimodal agent interface supporting voice interaction.

### Phase 9 — Text-to-SQL Agent

- Natural language querying of structured datasets (AWS RDS)
- **Resume bullet:** Implemented Text-to-SQL agents enabling natural language querying of structured datasets.

---

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
npm run build      # production build → frontend/dist
npm run lint       # ESLint
```

---

## Environment Variables

**Backend (`.env` in repo root or `backend/`):**

```
OPENAI_API_KEY=sk-...
LANGCHAIN_TRACING_V2=true              # optional — enables LangSmith tracing
LANGCHAIN_API_KEY=ls-...               # optional — required if tracing enabled
LANGCHAIN_PROJECT=ai-incident-triage
ALLOWED_ORIGINS=http://localhost:5173,https://main.dlvx8idi4h2r9.amplifyapp.com
```

**Frontend (`frontend/.env`):**

```
VITE_API_BASE_URL=http://localhost:8000
```

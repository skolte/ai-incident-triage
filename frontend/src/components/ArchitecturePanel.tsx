// ---------------------------------------------------------------------------
// ArchitecturePanel — showcases system architecture, agent workflow, and tech
// ---------------------------------------------------------------------------

const TECH_CATEGORIES = [
  {
    label: "AI / Agent",
    items: [
      { name: "LangGraph", desc: "ReAct agent orchestration" },
      { name: "LangChain", desc: "Tool integration & LLM abstraction" },
      { name: "OpenAI gpt-4o-mini", desc: "LLM backbone (temp=0)" },
      { name: "LangSmith", desc: "Tracing & observability" },
    ],
  },
  {
    label: "Backend",
    items: [
      { name: "FastAPI", desc: "Async Python API framework" },
      { name: "Pydantic v2", desc: "Schema validation" },
      { name: "asyncio", desc: "Concurrent streaming & execution" },
      { name: "SSE", desc: "Real-time event streaming" },
    ],
  },
  {
    label: "Frontend",
    items: [
      { name: "React 19", desc: "Component UI framework" },
      { name: "TypeScript", desc: "Type-safe development" },
      { name: "Vite", desc: "Build toolchain" },
      { name: "EventSource", desc: "SSE client for live streaming" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { name: "AWS ECS Fargate", desc: "Serverless container compute" },
      { name: "AWS Amplify", desc: "Frontend CI/CD & hosting" },
      { name: "CloudFront", desc: "CDN & HTTPS termination" },
      { name: "CloudFormation", desc: "Infrastructure as code (IaC)" },
      { name: "Amazon ECR", desc: "Docker image registry" },
      { name: "Amazon VPC", desc: "Isolated network with public subnets" },
      { name: "ALB", desc: "Application Load Balancer with health checks" },
      { name: "CloudWatch", desc: "Container logging & monitoring" },
    ],
  },
];

const AWS_RESOURCES = [
  { category: "Networking", items: [
    { name: "VPC", detail: "10.20.0.0/16 CIDR, DNS enabled" },
    { name: "Internet Gateway", detail: "Public internet access for subnets" },
    { name: "Public Subnet A", detail: "10.20.1.0/24, AZ-a, auto-assign public IP" },
    { name: "Public Subnet B", detail: "10.20.2.0/24, AZ-b, auto-assign public IP" },
    { name: "Route Table", detail: "Default route 0.0.0.0/0 via IGW" },
  ]},
  { category: "Security", items: [
    { name: "ALB Security Group", detail: "Allows inbound TCP:80 from anywhere" },
    { name: "ECS Security Group", detail: "Allows inbound from ALB SG only on port 8000" },
    { name: "IAM Execution Role", detail: "ECS task execution + ECR pull + CloudWatch write" },
  ]},
  { category: "Load Balancing", items: [
    { name: "Application Load Balancer", detail: "Internet-facing, 300s idle timeout" },
    { name: "Target Group", detail: "IP target type, health check on /healthz (HTTP 200)" },
    { name: "HTTP Listener", detail: "Port 80, forwards to target group" },
  ]},
  { category: "Compute", items: [
    { name: "ECS Cluster", detail: "ai-incident-cluster" },
    { name: "Task Definition", detail: "Fargate, 512 CPU / 1024 MB, x86_64 Linux" },
    { name: "ECS Service", detail: "Desired count 1, 60s health check grace period" },
  ]},
  { category: "Observability", items: [
    { name: "CloudWatch Log Group", detail: "/ecs/ai-incident, 14-day retention" },
  ]},
  { category: "Frontend", items: [
    { name: "AWS Amplify", detail: "CI/CD build from repo, publishes frontend/dist" },
    { name: "Amazon CloudFront", detail: "CDN distribution with HTTPS for Amplify app" },
  ]},
];

const TOOLS = [
  {
    name: "log_search",
    args: "service, contains, level",
    desc: "Searches logs.jsonl — filters by service name, message content, and log level. Returns up to 10 matching entries as evidence.",
    color: "var(--event-tool-call)",
  },
  {
    name: "list_runbooks",
    args: "",
    desc: "Lists all available operational runbooks (markdown files) so the agent can identify relevant remediation guides.",
    color: "var(--event-agent)",
  },
  {
    name: "read_runbook",
    args: "filename",
    desc: "Reads the full content of a specific runbook to extract step-by-step remediation procedures.",
    color: "var(--event-run)",
  },
  {
    name: "policy_check",
    args: "text",
    desc: "Scans text for compliance keywords — flags PII exposure, regulated domains, and potential data exfiltration.",
    color: "var(--event-final)",
  },
];

const WORKFLOW_STEPS = [
  {
    num: "1",
    title: "Incident Submitted",
    desc: "User submits an incident description via the React frontend. A POST request creates a unique run_id and starts a background task.",
    accent: "var(--accent)",
  },
  {
    num: "2",
    title: "Orchestrator Initializes",
    desc: "SingleAgentOrchestrator creates an asyncio.Queue for the run, emits run_started, and hands off to the TriageAgent.",
    accent: "var(--event-run)",
  },
  {
    num: "3",
    title: "ReAct Agent Reasons",
    desc: "The LangGraph ReAct agent analyzes the incident, decides which tools to call, and iterates until it has enough evidence.",
    accent: "var(--event-agent)",
  },
  {
    num: "4",
    title: "Tools Gather Evidence",
    desc: "The agent calls log_search, list_runbooks, read_runbook, and policy_check — each emitting tool_call and tool_result events in real time.",
    accent: "var(--event-tool-call)",
  },
  {
    num: "5",
    title: "Ticket Generated",
    desc: "The agent produces a structured IncidentTicket (JSON) validated by Pydantic — with severity, root cause, evidence, mitigation plan, and compliance flags.",
    accent: "var(--event-final)",
  },
  {
    num: "6",
    title: "Streamed to UI",
    desc: "Every step streams via SSE to the frontend in real time. The UI renders the trace timeline, observability metrics, and final ticket as events arrive.",
    accent: "var(--success)",
  },
];

const SSE_EVENTS = [
  { name: "run_started", emitter: "Orchestrator", color: "var(--event-run)" },
  { name: "agent_started", emitter: "TriageAgent", color: "var(--event-agent)" },
  { name: "tool_call", emitter: "Tool wrapper", color: "var(--event-tool-call)" },
  { name: "tool_result", emitter: "Tool wrapper", color: "var(--event-tool-result)" },
  { name: "agent_completed", emitter: "TriageAgent", color: "var(--event-agent)" },
  { name: "metrics", emitter: "TriageAgent", color: "var(--event-run)" },
  { name: "final_result", emitter: "Orchestrator", color: "var(--event-final)" },
  { name: "error", emitter: "Orchestrator", color: "var(--event-error)" },
  { name: "heartbeat", emitter: "SSE endpoint", color: "var(--event-muted)" },
];

const DESIGN_DECISIONS = [
  {
    title: "asyncio.Queue per run",
    detail: "Clean per-run isolation — each SSE connection reads only its own queue. No cross-run event leakage.",
  },
  {
    title: "emit_sync() bridge",
    detail: "Tool callbacks are synchronous (executor threads), but the event queue is async. run_coroutine_threadsafe() bridges the gap safely.",
  },
  {
    title: "run_in_executor for agent.invoke()",
    detail: "The blocking LangGraph call runs in a thread pool so the event loop stays responsive for SSE heartbeats.",
  },
  {
    title: "JSON-only system prompt",
    detail: "Output is parsed with json.loads() directly — no markdown fences allowed. Pydantic validates the parsed dict.",
  },
  {
    title: "Dual-path token extraction",
    detail: "Handles both new usage_metadata and legacy response_metadata APIs for cross-version LangChain compatibility.",
  },
];

export default function ArchitecturePanel() {
  return (
    <div className="arch">
      {/* ── Section: Architecture Diagram ─────────────────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#9783;</span>
          <div>
            <h3 className="arch-section-title">System Architecture</h3>
            <p className="arch-section-desc">End-to-end request flow from browser to AI agent and back</p>
          </div>
        </div>

        <div className="arch-diagram">
          <div className="arch-diagram-col">
            <div className="arch-node arch-node--user">
              <span className="arch-node-icon">&#9653;</span>
              <div>
                <div className="arch-node-label">React Frontend</div>
                <div className="arch-node-sub">Vite + TypeScript</div>
              </div>
            </div>
            <div className="arch-arrow">POST /api/triage</div>

            <div className="arch-node arch-node--infra">
              <span className="arch-node-icon">&#9729;</span>
              <div>
                <div className="arch-node-label">AWS Cloud</div>
                <div className="arch-node-sub">CloudFront &rarr; ALB &rarr; ECS Fargate</div>
              </div>
            </div>
            <div className="arch-arrow">routes to container</div>

            <div className="arch-node arch-node--api">
              <span className="arch-node-icon">&#9881;</span>
              <div>
                <div className="arch-node-label">FastAPI</div>
                <div className="arch-node-sub">Creates run_id + asyncio.Queue, starts background task</div>
              </div>
            </div>
            <div className="arch-arrow">delegates to orchestrator</div>

            <div className="arch-node arch-node--orch">
              <span className="arch-node-icon">&#9654;</span>
              <div>
                <div className="arch-node-label">SingleAgentOrchestrator</div>
                <div className="arch-node-sub">Lifecycle: run_started &rarr; agent &rarr; final_result</div>
              </div>
            </div>
            <div className="arch-arrow">invokes agent</div>

            <div className="arch-node arch-node--agent">
              <span className="arch-node-icon">&#10070;</span>
              <div>
                <div className="arch-node-label">TriageAgent (LangGraph ReAct)</div>
                <div className="arch-node-sub">gpt-4o-mini &middot; tool-calling loop &middot; structured output</div>
              </div>
            </div>
          </div>

          <div className="arch-diagram-col arch-diagram-col--tools">
            <div className="arch-tools-label">Agent Tools</div>
            {TOOLS.map((t) => (
              <div key={t.name} className="arch-tool-card" style={{ borderLeftColor: t.color }}>
                <code className="arch-tool-name">{t.name}</code>
                {t.args && <span className="arch-tool-args">({t.args})</span>}
                <p className="arch-tool-desc">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section: Agent Workflow ───────────────────────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#8635;</span>
          <div>
            <h3 className="arch-section-title">Agent Workflow</h3>
            <p className="arch-section-desc">Step-by-step execution pipeline from incident to ticket</p>
          </div>
        </div>

        <div className="arch-workflow">
          {WORKFLOW_STEPS.map((s, i) => (
            <div key={i} className="arch-wf-step">
              <div className="arch-wf-num" style={{ background: s.accent }}>{s.num}</div>
              <div className="arch-wf-body">
                <div className="arch-wf-title">{s.title}</div>
                <div className="arch-wf-desc">{s.desc}</div>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && <div className="arch-wf-connector" />}
            </div>
          ))}
        </div>
      </section>

      {/* ── Section: SSE Event Protocol ──────────────────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#9889;</span>
          <div>
            <h3 className="arch-section-title">Real-Time SSE Protocol</h3>
            <p className="arch-section-desc">Events streamed from backend to frontend during each run</p>
          </div>
        </div>

        <div className="arch-sse-grid">
          {SSE_EVENTS.map((e) => (
            <div key={e.name} className="arch-sse-item">
              <span className="arch-sse-dot" style={{ background: e.color }} />
              <code className="arch-sse-name">{e.name}</code>
              <span className="arch-sse-emitter">{e.emitter}</span>
            </div>
          ))}
        </div>

        <div className="arch-sse-flow">
          <span className="arch-sse-flow-label">Event sequence:</span>
          <code className="arch-sse-flow-code">
            run_started &rarr; agent_started &rarr; [tool_call &rarr; tool_result]* &rarr; agent_completed &rarr; metrics &rarr; final_result
          </code>
        </div>
      </section>

      {/* ── Section: Technology Stack ────────────────────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#9776;</span>
          <div>
            <h3 className="arch-section-title">Technology Stack</h3>
            <p className="arch-section-desc">Full-stack technologies powering the system</p>
          </div>
        </div>

        <div className="arch-tech-grid">
          {TECH_CATEGORIES.map((cat) => (
            <div key={cat.label} className="arch-tech-category">
              <div className="arch-tech-cat-label">{cat.label}</div>
              <div className="arch-tech-items">
                {cat.items.map((item) => (
                  <div key={item.name} className="arch-tech-item">
                    <div className="arch-tech-name">{item.name}</div>
                    <div className="arch-tech-desc">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section: Incident Ticket Schema ──────────────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#9998;</span>
          <div>
            <h3 className="arch-section-title">IncidentTicket Schema</h3>
            <p className="arch-section-desc">Pydantic-validated structured output from the agent</p>
          </div>
        </div>

        <div className="arch-schema">
          <pre className="arch-schema-code">{`{
  "title":              "string",
  "severity":           "SEV1 | SEV2 | SEV3 | SEV4",
  "impacted_services":  ["string"],
  "suspected_root_cause": "string",
  "evidence":           ["string"],
  "mitigation_plan":    ["string"],
  "customer_impact":    "string",
  "compliance_flags":   ["string"],
  "followup_questions": ["string"],
  "confidence":         0.0 - 1.0
}`}</pre>
        </div>
      </section>

      {/* ── Section: Design Decisions ────────────────────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#9670;</span>
          <div>
            <h3 className="arch-section-title">Key Design Decisions</h3>
            <p className="arch-section-desc">Architectural trade-offs and why they were made</p>
          </div>
        </div>

        <div className="arch-decisions">
          {DESIGN_DECISIONS.map((d, i) => (
            <div key={i} className="arch-decision">
              <div className="arch-decision-title">{d.title}</div>
              <div className="arch-decision-detail">{d.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section: AWS Infrastructure ─────────────────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#9729;</span>
          <div>
            <h3 className="arch-section-title">AWS Infrastructure (CloudFormation)</h3>
            <p className="arch-section-desc">
              19 resources deployed via <code>ai-incident-full-stack.yaml</code> — full IaC template
            </p>
          </div>
        </div>

        <div className="arch-aws-grid">
          {AWS_RESOURCES.map((group) => (
            <div key={group.category} className="arch-aws-group">
              <div className="arch-aws-cat">{group.category}</div>
              {group.items.map((r) => (
                <div key={r.name} className="arch-aws-item">
                  <div className="arch-aws-name">{r.name}</div>
                  <div className="arch-aws-detail">{r.detail}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="arch-sse-flow" style={{ marginTop: 16 }}>
          <span className="arch-sse-flow-label">Deployment flow:</span>
          <code className="arch-sse-flow-code">
            Docker build &rarr; ECR push &rarr; CloudFormation deploy &rarr; ECS Fargate runs container &rarr; ALB routes traffic
          </code>
        </div>
      </section>

      {/* ── Section: Backend Layer Map ───────────────────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#128193;</span>
          <div>
            <h3 className="arch-section-title">Backend Layer Map</h3>
            <p className="arch-section-desc">How the backend code is organized</p>
          </div>
        </div>

        <div className="arch-schema">
          <pre className="arch-schema-code">{`backend/app/
  app.py                            FastAPI app, 6 endpoints, CORS
  orchestrators/
    single_agent_orchestrator.py    run lifecycle management
    supervisor_orchestrator.py      multi-agent stub (future)
  agents/
    base_agent.py                   abstract BaseAgent interface
    triage_agent.py                 LangGraph ReAct agent + tools
  tools/
    log_tools.py                    log_search (logs.jsonl)
    runbook_tools.py                list & read runbooks (.md)
    policy_tools.py                 compliance keyword scanner
  core/
    run_store.py                    in-memory run state + queues
    sse.py                          SSE formatting helpers
  schemas/
    incident.py                     IncidentTicket model
    events.py                       StreamEvent (11 types)
    state.py                        AgentState
    api.py                          request/response models
  data/
    logs.jsonl                      sample operational logs
    runbooks/                       remediation guides (.md)`}</pre>
        </div>
      </section>

      {/* ── Section: API Documentation ───────────────────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#128214;</span>
          <div>
            <h3 className="arch-section-title">API Documentation</h3>
            <p className="arch-section-desc">REST endpoints exposed by the FastAPI backend</p>
          </div>
        </div>

        <div className="arch-api-table">
          <div className="arch-api-row arch-api-row--header">
            <span className="arch-api-method">Method</span>
            <span className="arch-api-path">Path</span>
            <span className="arch-api-desc">Description</span>
          </div>
          {[
            { method: "POST", path: "/api/triage", desc: "Start a triage run. Returns { run_id }." },
            { method: "GET", path: "/api/triage/stream/{run_id}", desc: "SSE stream of all run events in real time." },
            { method: "GET", path: "/api/triage/{run_id}", desc: "Full run state: status, events, final result." },
            { method: "GET", path: "/api/triage/{run_id}/trace", desc: "LangSmith trace data for the run." },
            { method: "GET", path: "/health", desc: "Async health check endpoint." },
            { method: "GET", path: "/healthz", desc: "Sync health check (used by ALB target group)." },
          ].map((ep) => (
            <div key={ep.path} className="arch-api-row">
              <span className={`arch-api-method arch-api-method--${ep.method.toLowerCase()}`}>{ep.method}</span>
              <code className="arch-api-path">{ep.path}</code>
              <span className="arch-api-desc">{ep.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section: Environment & Configuration ─────────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#9881;</span>
          <div>
            <h3 className="arch-section-title">Environment & Configuration</h3>
            <p className="arch-section-desc">Required environment variables and runtime configuration</p>
          </div>
        </div>

        <div className="arch-env-grid">
          <div className="arch-env-group">
            <div className="arch-aws-cat">Backend (.env)</div>
            {[
              { name: "OPENAI_API_KEY", desc: "OpenAI API key for gpt-4o-mini" },
              { name: "ALLOWED_ORIGINS", desc: "Comma-separated CORS origins" },
              { name: "LANGCHAIN_TRACING_V2", desc: "Enable LangSmith tracing (optional)" },
              { name: "LANGCHAIN_API_KEY", desc: "LangSmith API key (optional)" },
              { name: "LANGCHAIN_PROJECT", desc: "LangSmith project name" },
            ].map((v) => (
              <div key={v.name} className="arch-aws-item">
                <code className="arch-aws-name">{v.name}</code>
                <div className="arch-aws-detail">{v.desc}</div>
              </div>
            ))}
          </div>
          <div className="arch-env-group">
            <div className="arch-aws-cat">Frontend (.env)</div>
            <div className="arch-aws-item">
              <code className="arch-aws-name">VITE_API_BASE_URL</code>
              <div className="arch-aws-detail">Backend API URL (e.g. http://localhost:8000)</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

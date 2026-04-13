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
    title: "Supervisor Orchestrator Initializes",
    desc: "SupervisorOrchestrator creates an asyncio.Queue, emits run_started, and begins routing through three specialist agents sequentially.",
    accent: "var(--event-run)",
  },
  {
    num: "3",
    title: "LogAnalysisAgent — Evidence Gathering",
    desc: "Searches logs aggressively using log_search to identify error patterns, service failures, and correlated timestamps. Produces a structured evidence summary stored in shared state.",
    accent: "var(--event-tool-call)",
  },
  {
    num: "4",
    title: "ComplianceAgent — Policy & Runbook Analysis",
    desc: "Receives log evidence, runs policy_check for PII/compliance flags, and consults runbooks for remediation guidance. Adds compliance findings to shared state.",
    accent: "var(--event-handoff)",
  },
  {
    num: "5",
    title: "TriageAgent — Final Synthesis",
    desc: "Receives all accumulated evidence from prior agents. Synthesizes into a structured IncidentTicket (JSON) validated by Pydantic — with severity, root cause, evidence, mitigation plan, and compliance flags.",
    accent: "var(--event-agent)",
  },
  {
    num: "6",
    title: "Streamed to UI",
    desc: "Every step from all three agents streams via SSE to the frontend in real time. Handoff events mark transitions between agents. The UI renders the trace timeline, observability metrics, and final ticket.",
    accent: "var(--success)",
  },
];

const SSE_EVENTS = [
  { name: "run_started", emitter: "Supervisor", color: "var(--event-run)" },
  { name: "handoff", emitter: "Supervisor", color: "var(--event-handoff)" },
  { name: "agent_started", emitter: "Each agent", color: "var(--event-agent)" },
  { name: "tool_call", emitter: "Tool wrapper", color: "var(--event-tool-call)" },
  { name: "tool_result", emitter: "Tool wrapper", color: "var(--event-tool-result)" },
  { name: "agent_completed", emitter: "Each agent", color: "var(--event-agent)" },
  { name: "metrics", emitter: "TriageAgent", color: "var(--event-run)" },
  { name: "final_result", emitter: "Supervisor", color: "var(--event-final)" },
  { name: "error", emitter: "Supervisor", color: "var(--event-error)" },
  { name: "heartbeat", emitter: "SSE endpoint", color: "var(--event-muted)" },
];

const DESIGN_DECISIONS = [
  {
    title: "Multi-agent supervisor pattern",
    detail: "Three specialist agents (LogAnalysis, Compliance, Triage) coordinated by a SupervisorOrchestrator. State flows sequentially — each agent builds on prior findings via shared AgentState.",
  },
  {
    title: "Sequential over parallel execution",
    detail: "Agents run sequentially because of data dependencies: Compliance needs Log findings, Triage needs both. Sequential + shared state is simpler and more deterministic than parallel fan-out with merge logic.",
  },
  {
    title: "Handoff events for agent transitions",
    detail: "The supervisor emits handoff events between agents so the UI can visualize transitions. Each agent emits its own agent_started/agent_completed events for fine-grained tracking.",
  },
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
  {
    title: "In-memory RunStore",
    detail: "Transient run state lives for the session duration—simplicity by design. Persistence (DynamoDB, PostgreSQL) is a planned roadmap item.",
  },
];

export default function ArchitecturePanel() {
  return (
    <div className="arch">
      {/* ── Section: Application Architecture Diagram ─────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#9783;</span>
          <div>
            <h3 className="arch-section-title">Application Architecture</h3>
            <p className="arch-section-desc">End-to-end request flow from browser to AI agent and back</p>
          </div>
        </div>

        <div className="diag">
          {/* Row 1: User + Frontend */}
          <div className="diag-row">
            <div className="diag-box diag-box--green">
              <div className="diag-box-label">User (Browser)</div>
            </div>
            <div className="diag-conn">
              <div className="diag-conn-line" />
              <span className="diag-conn-label">incident text</span>
            </div>
            <div className="diag-box diag-box--green">
              <div className="diag-box-title">React Frontend</div>
              <div className="diag-box-sub">Vite + TypeScript + SSE</div>
            </div>
          </div>
          <div className="diag-vert" />

          {/* Row 2: API layer */}
          <div className="diag-row">
            <div className="diag-box diag-box--yellow">
              <div className="diag-box-title">FastAPI</div>
              <div className="diag-box-sub">POST /api/triage &rarr; run_id</div>
              <div className="diag-box-sub">GET /api/triage/stream/&#123;id&#125; &rarr; SSE</div>
            </div>
            <div className="diag-conn">
              <div className="diag-conn-line" />
              <span className="diag-conn-label">asyncio.Queue</span>
            </div>
            <div className="diag-box diag-box--blue">
              <div className="diag-box-title">RunStore</div>
              <div className="diag-box-sub">In-memory run state</div>
              <div className="diag-box-sub">Queue per run + SSE formatter</div>
            </div>
          </div>
          <div className="diag-vert" />

          {/* Row 3: Supervisor Orchestrator */}
          <div className="diag-row">
            <div className="diag-box diag-box--blue diag-box--lg">
              <div className="diag-box-title">SupervisorOrchestrator</div>
              <div className="diag-box-sub">Routes agents sequentially with handoff events &middot; Shared AgentState</div>
            </div>
          </div>
          <div className="diag-vert" />

          {/* Row 4: Three agents + tools */}
          <div className="diag-row">
            {/* Agent 1: Log Analysis */}
            <div className="diag-box diag-box--purple">
              <div className="diag-box-title">LogAnalysisAgent</div>
              <div className="diag-box-sub">Searches logs &middot; identifies error patterns</div>
              <div className="diag-container-inner">
                <span className="diag-container-chip">log_search</span>
              </div>
            </div>

            <div className="diag-conn">
              <div className="diag-conn-line" />
              <span className="diag-conn-label">handoff</span>
            </div>

            {/* Agent 2: Compliance */}
            <div className="diag-box diag-box--purple">
              <div className="diag-box-title">ComplianceAgent</div>
              <div className="diag-box-sub">Policy checks &middot; runbook remediation</div>
              <div className="diag-container-inner">
                <span className="diag-container-chip">policy_check</span>
                <span className="diag-container-chip">list_runbooks</span>
                <span className="diag-container-chip">read_runbook</span>
              </div>
            </div>

            <div className="diag-conn">
              <div className="diag-conn-line" />
              <span className="diag-conn-label">handoff</span>
            </div>

            {/* Agent 3: Triage */}
            <div className="diag-box diag-box--purple">
              <div className="diag-box-title">TriageAgent</div>
              <div className="diag-box-sub">Synthesizes evidence &middot; produces ticket</div>
              <div className="diag-container-inner">
                <span className="diag-container-chip">all 4 tools</span>
              </div>
            </div>
          </div>
          <div className="diag-vert" />

          {/* ReAct loop detail */}
          <div className="diag-row">
            <div className="diag-box diag-box--purple diag-box--lg">
              <div className="diag-agent-inner">
                <div className="diag-agent-loop">
                  <div className="diag-loop-label">Each Agent: LangGraph ReAct Loop</div>
                  <div className="diag-loop-steps">
                    <span className="diag-loop-step">Observe</span>
                    <span className="diag-loop-arrow">&rarr;</span>
                    <span className="diag-loop-step">Think</span>
                    <span className="diag-loop-arrow">&rarr;</span>
                    <span className="diag-loop-step">Act (tool call)</span>
                    <span className="diag-loop-arrow">&rarr;</span>
                    <span className="diag-loop-step">Repeat</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="diag-conn">
              <div className="diag-conn-line" />
              <span className="diag-conn-label">tool calls</span>
            </div>

            <div className="diag-tools-col">
              {TOOLS.map((t) => (
                <div key={t.name} className="diag-tool" style={{ borderLeftColor: t.color }}>
                  <code className="diag-tool-name">{t.name}</code>
                  {t.args && <span className="diag-tool-args">({t.args})</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="diag-vert" />

          {/* Row 5: Output */}
          <div className="diag-row">
            <div className="diag-box diag-box--teal">
              <div className="diag-box-title">IncidentTicket</div>
              <div className="diag-box-sub">Pydantic v2 validated JSON (11 fields)</div>
            </div>
            <div className="diag-conn diag-conn--reverse">
              <div className="diag-conn-line" />
              <span className="diag-conn-label">SSE events stream back to UI</span>
            </div>
            <div className="diag-box diag-box--green">
              <div className="diag-box-title">Frontend UI</div>
              <div className="diag-box-sub">TracePanel + TicketViewer + Observability</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: AWS Deployment Diagram ───────────────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#9729;</span>
          <div>
            <h3 className="arch-section-title">AWS Deployment Architecture</h3>
            <p className="arch-section-desc">Cloud infrastructure provisioned via CloudFormation (19 resources)</p>
          </div>
        </div>

        <div className="diag">
          {/* Top row: Users */}
          <div className="diag-row">
            <div className="diag-box diag-box--green">
              <div className="diag-box-label">Users</div>
            </div>
          </div>
          <div className="diag-vert" />

          {/* CDN + Frontend */}
          <div className="diag-row">
            <div className="diag-box diag-box--orange">
              <div className="diag-box-title">CloudFront CDN</div>
              <div className="diag-box-sub">HTTPS termination</div>
            </div>
            <div className="diag-conn">
              <div className="diag-conn-line" />
            </div>
            <div className="diag-box diag-box--orange">
              <div className="diag-box-title">AWS Amplify</div>
              <div className="diag-box-sub">React build (frontend/dist)</div>
            </div>
          </div>
          <div className="diag-vert" />

          {/* VPC boundary */}
          <div className="diag-vpc">
            <div className="diag-vpc-label">VPC 10.20.0.0/16</div>

            {/* ALB */}
            <div className="diag-row">
              <div className="diag-box diag-box--orange">
                <div className="diag-box-title">Application Load Balancer</div>
                <div className="diag-box-sub">Internet-facing &middot; Port 80 &middot; 300s timeout</div>
              </div>
            </div>
            <div className="diag-vert" />

            {/* Target Group */}
            <div className="diag-row">
              <div className="diag-box diag-box--yellow">
                <div className="diag-box-title">Target Group</div>
                <div className="diag-box-sub">Health check: /healthz (HTTP 200, 10s interval)</div>
              </div>
            </div>
            <div className="diag-vert" />

            {/* Subnets + ECS */}
            <div className="diag-row">
              <div className="diag-subnet">
                <div className="diag-subnet-label">Public Subnet A (10.20.1.0/24)</div>
                <div className="diag-box diag-box--purple">
                  <div className="diag-box-title">ECS Service</div>
                  <div className="diag-box-sub">Fargate &middot; 512 CPU &middot; 1024 MB</div>
                </div>
              </div>
              <div className="diag-conn">
                <div className="diag-conn-line diag-conn-line--dashed" />
                <span className="diag-conn-label">AZ failover</span>
              </div>
              <div className="diag-subnet">
                <div className="diag-subnet-label">Public Subnet B (10.20.2.0/24)</div>
                <div className="diag-box diag-box--purple diag-box--faded">
                  <div className="diag-box-title">ECS (standby)</div>
                  <div className="diag-box-sub">Available for scaling</div>
                </div>
              </div>
            </div>
            <div className="diag-vert" />

            {/* Container detail */}
            <div className="diag-row">
              <div className="diag-box diag-box--blue diag-box--lg">
                <div className="diag-box-title">Docker Container</div>
                <div className="diag-box-sub">Python 3.11-slim &middot; FastAPI + LangGraph Agent</div>
                <div className="diag-container-inner">
                  <span className="diag-container-chip">FastAPI</span>
                  <span className="diag-container-chip">LangGraph</span>
                  <span className="diag-container-chip">LangChain</span>
                  <span className="diag-container-chip">Pydantic</span>
                </div>
              </div>
            </div>
          </div>
          <div className="diag-vert" />

          {/* External services */}
          <div className="diag-row">
            <div className="diag-box diag-box--teal">
              <div className="diag-box-title">OpenAI API</div>
              <div className="diag-box-sub">gpt-4o-mini</div>
            </div>
            <div className="diag-box diag-box--yellow">
              <div className="diag-box-title">LangSmith</div>
              <div className="diag-box-sub">Tracing (optional)</div>
            </div>
            <div className="diag-box diag-box--orange">
              <div className="diag-box-title">CloudWatch</div>
              <div className="diag-box-sub">Logs (14-day retention)</div>
            </div>
            <div className="diag-box diag-box--orange">
              <div className="diag-box-title">Amazon ECR</div>
              <div className="diag-box-sub">Docker image registry</div>
            </div>
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

      {/* ── Section: Observability & Tokenomics ────────────── */}
      <section className="arch-section">
        <div className="arch-section-header">
          <span className="arch-section-icon">&#9888;</span>
          <div>
            <h3 className="arch-section-title">Observability & Tokenomics</h3>
            <p className="arch-section-desc">How tokens, costs, and latency are tracked and displayed</p>
          </div>
        </div>

        <div className="arch-obs-explainer">
          <div className="arch-obs-card">
            <div className="arch-obs-card-title">Data Collection</div>
            <p className="arch-obs-card-text">
              The <code>TriageAgent</code> collects metrics throughout its execution. Token counts are extracted
              from the LLM response via <code>usage_metadata</code> (or legacy <code>response_metadata</code>).
              Tool durations are measured with <code>time.monotonic()</code> around each tool call.
              End-to-end latency is measured from agent start to completion.
            </p>
          </div>

          <div className="arch-obs-card">
            <div className="arch-obs-card-title">When Metrics Are Emitted</div>
            <p className="arch-obs-card-text">
              The <code>metrics</code> SSE event is emitted <strong>after</strong> <code>agent_completed</code> and
              <strong> before</strong> <code>final_result</code>. If the agent errors out (bad JSON, schema validation
              failure), the exception skips past the metrics code — so metrics are <strong>only available on successful runs</strong>.
            </p>
          </div>

          <div className="arch-obs-card">
            <div className="arch-obs-card-title">Cost Calculation (gpt-4o-mini)</div>
            <p className="arch-obs-card-text">
              Costs are estimated using OpenAI's published pricing constants hardcoded in <code>triage_agent.py</code>:
            </p>
            <div className="arch-obs-pricing">
              <div className="arch-obs-price-row">
                <span className="arch-obs-price-label">Input (prompt) tokens</span>
                <code className="arch-obs-price-value">$0.150 / 1M tokens</code>
              </div>
              <div className="arch-obs-price-row">
                <span className="arch-obs-price-label">Output (completion) tokens</span>
                <code className="arch-obs-price-value">$0.600 / 1M tokens</code>
              </div>
            </div>
            <p className="arch-obs-card-text">
              Formula: <code>cost = (prompt_tokens * $0.00000015) + (completion_tokens * $0.0000006)</code>
            </p>
          </div>

          <div className="arch-obs-card">
            <div className="arch-obs-card-title">What's Displayed</div>
            <div className="arch-obs-metrics-list">
              <div><strong>Token Usage</strong> — stacked bar showing prompt vs completion tokens</div>
              <div><strong>Estimated Cost</strong> — USD cost for the run based on gpt-4o-mini pricing</div>
              <div><strong>Total Latency</strong> — end-to-end wall-clock time (agent + all tool calls)</div>
              <div><strong>Tool Performance</strong> — per-tool latency bar chart with call count and average</div>
              <div><strong>LangSmith Link</strong> — direct link to the full execution trace in LangSmith</div>
            </div>
          </div>

          <div className="arch-obs-card">
            <div className="arch-obs-card-title">Run History (localStorage)</div>
            <p className="arch-obs-card-text">
              After each successful run, the frontend persists a record to <code>localStorage</code> containing
              run ID, timestamp, incident text, ticket title, severity, cost, tokens, latency, tool count, and
              LangSmith URL. The RunHistoryPanel displays up to 10 recent runs with aggregate stats.
            </p>
          </div>
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
    supervisor_orchestrator.py      multi-agent coordinator (active)
    single_agent_orchestrator.py    single-agent fallback
  agents/
    base_agent.py                   abstract BaseAgent interface
    log_analysis_agent.py           log search & pattern detection
    compliance_agent.py             policy checks & runbook analysis
    triage_agent.py                 final ticket synthesis (ReAct)
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
    state.py                        AgentState (shared across agents)
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

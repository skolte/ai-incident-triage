import { useRef, useState } from "react";
import IncidentForm from "./components/IncidentForm";
import LangSmithTrace from "./components/LangSmithTrace";
import LogFileExplorer from "./components/LogFileExplorer";
import ObservabilityPanel from "./components/ObservabilityPanel";
import PipelineViz from "./components/PipelineViz";
import RunHistoryPanel, { saveRunRecord } from "./components/RunHistoryPanel";
import TicketViewer from "./components/TicketViewer";
import TracePanel from "./components/TracePanel";

import {
  connectToRunStream,
  startTriage,
  type IncidentTicket,
  type MetricsData,
  type StreamEvent,
} from "./api";

// ---------------------------------------------------------------------------
// Scenario cards shown on the landing page
// ---------------------------------------------------------------------------
const SCENARIOS = [
  {
    id: "502-checkout",
    category: "Gateway Error",
    severity: "SEV2",
    severityColor: "var(--sev2)",
    title: "Checkout 502 Errors",
    desc: "Users report intermittent 502 errors during checkout, started about 10 minutes ago. Error rate is ~15% of requests.",
    tags: ["api-gateway", "logs", "runbook"],
  },
  {
    id: "auth-failures",
    category: "Auth Failure",
    severity: "SEV3",
    severityColor: "var(--sev3)",
    title: "Login Failure Spike",
    desc: "Login failures increased sharply after a recent deployment. Users report token errors and are being logged out mid-session.",
    tags: ["auth-service", "compliance", "policy"],
  },
  {
    id: "payment-timeouts",
    category: "Payment",
    severity: "SEV1",
    severityColor: "var(--sev1)",
    title: "Payment Timeouts",
    desc: "Payments are timing out and customer support is seeing multiple failed orders. Revenue impact is growing by the minute.",
    tags: ["payment-service", "db-latency", "runbook"],
  },
];

const TECH_STACK = ["LangGraph", "FastAPI", "React", "OpenAI", "SSE", "AWS ECS"];

export default function App() {
  const [runId, setRunId]         = useState<string | null>(null);
  const [events, setEvents]       = useState<StreamEvent[]>([]);
  const [ticket, setTicket]       = useState<IncidentTicket | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [appError, setAppError]   = useState<string | null>(null);
  const [metrics, setMetrics]     = useState<MetricsData | null>(null);
  const [lastText, setLastText]       = useState<string>("");
  const [historyKey, setHistoryKey]   = useState(0);   // bumped to refresh RunHistoryPanel

  const cleanupRef = useRef<null | (() => void)>(null);

  function handleGoHome() {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setRunId(null);
    setEvents([]);
    setTicket(null);
    setMetrics(null);
    setAppError(null);
    setIsRunning(false);
  }

  async function handleStartTriage(incidentText: string) {
    setAppError(null);
    setIsRunning(true);
    setEvents([]);
    setTicket(null);
    setMetrics(null);
    setLastText(incidentText);

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    try {
      const result = await startTriage(incidentText);
      setRunId(result.run_id);

      cleanupRef.current = connectToRunStream(
        result.run_id,
        (event) => {
          setEvents((prev) => [...prev, event]);
          if (event.type === "metrics")      setMetrics(event.data as unknown as MetricsData);
          if (event.type === "final_result") {
            const t = event.data.ticket as IncidentTicket | undefined;
            if (t) setTicket(t);
            setIsRunning(false);
            // Persist run summary for the observability history panel
            setMetrics((m) => {
              if (m) {
                saveRunRecord({
                  runId: result.run_id,
                  timestamp: new Date().toISOString(),
                  incidentText: incidentText,
                  ticketTitle: t?.title,
                  severity: t?.severity,
                  cost: m.estimated_cost_usd,
                  tokens: m.total_tokens,
                  latencyMs: m.latency_ms,
                  toolCount: m.tool_count,
                  langsmithUrl: m.langsmith_url,
                });
                setHistoryKey((k) => k + 1);
              }
              return m;
            });
          }
          if (event.type === "error") {
            setAppError(typeof event.data.message === "string" ? event.data.message : "Backend error");
            setIsRunning(false);
          }
        },
        () => setIsRunning(false)
      );
    } catch (err) {
      setAppError(err instanceof Error ? err.message : "Failed to start triage");
      setIsRunning(false);
    }
  }

  const isLanding = !runId && !isRunning;

  return (
    <div className="app-shell">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-icon">⚡</div>
          <div>
            <h1>Incident Triage Agent</h1>
            <p className="subtitle">LangGraph · FastAPI · React · AWS ECS Fargate</p>
          </div>
        </div>

        {!isLanding && (
          <div className="header-metrics">
            <button
              className="back-home-btn"
              onClick={handleGoHome}
              disabled={isRunning}
              title="Back to main screen"
            >
              ← New Triage
            </button>
            <div className="metric-pill">
              <span className={`status-dot ${isRunning ? "status-dot--running" : "status-dot--idle"}`} />
              <span>{isRunning ? "Running" : "Done"}</span>
            </div>
            <div className="metric-item">
              <span className="metric-value">{events.length}</span>
              <span className="metric-label">Events</span>
            </div>
            <div className="metric-item">
              <span className="metric-value">{events.filter((e) => e.type === "tool_call").length}</span>
              <span className="metric-label">Tool Calls</span>
            </div>
            {metrics && (
              <div className="metric-item metric-item--cost">
                <span className="metric-value metric-value--cost">
                  {metrics.estimated_cost_usd < 0.001
                    ? `$${metrics.estimated_cost_usd.toFixed(5)}`
                    : `$${metrics.estimated_cost_usd.toFixed(4)}`}
                </span>
                <span className="metric-label">Run Cost</span>
              </div>
            )}
            {metrics && (
              <div className="metric-item">
                <span className="metric-value">{metrics.total_tokens.toLocaleString()}</span>
                <span className="metric-label">Tokens</span>
              </div>
            )}
            {runId && (
              <div className="metric-item metric-item--mono">
                <span className="metric-value">{runId.slice(0, 8)}</span>
                <span className="metric-label">Run ID</span>
              </div>
            )}
          </div>
        )}
      </header>

      {appError && (
        <div className="error-banner">
          <span className="error-icon">✕</span>
          <strong>Error:</strong>&nbsp;{appError}
        </div>
      )}

      {/* ── Landing ───────────────────────────────────────────────── */}
      {isLanding && (
        <div className="landing">
          <div className="landing-hero">
            <div className="landing-badge">Live AI Demo</div>
            <h2 className="landing-title">Incident Triage, Automated</h2>
            <p className="landing-desc">
              The AI agent searches thousands of logs, consults runbooks, runs compliance checks —
              then produces a structured ticket in real time. Every reasoning step streams to the UI as it happens.
            </p>
            <div className="landing-tech-row">
              {TECH_STACK.map((t) => (
                <span key={t} className="landing-tech-chip">{t}</span>
              ))}
            </div>
          </div>

          {/* Observability history — visible after first run */}
          <RunHistoryPanel refreshKey={historyKey} />

          {/* Step 1 */}
          <div className="landing-step">
            <div className="landing-step-header">
              <span className="landing-step-num">1</span>
              <div>
                <div className="landing-step-title">The Data Sources</div>
                <div className="landing-step-desc">
                  Logs and runbooks stored on the backend — the agent searches all of this in seconds
                </div>
              </div>
            </div>
            <LogFileExplorer />
          </div>

          {/* Step 2 */}
          <div className="landing-step">
            <div className="landing-step-header">
              <span className="landing-step-num">2</span>
              <div>
                <div className="landing-step-title">Run a Scenario</div>
                <div className="landing-step-desc">
                  Click any card to start a live triage run — the agent reasons through logs, runbooks, and compliance checks in real time
                </div>
              </div>
            </div>
            <div className="landing-scenario-grid">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  className="scenario-card"
                  onClick={() => handleStartTriage(s.desc)}
                  disabled={isRunning}
                  style={{ "--card-color": s.severityColor } as React.CSSProperties}
                >
                  <div className="scenario-card-top">
                    <span className="scenario-category">{s.category}</span>
                    <span className="scenario-sev" style={{ color: s.severityColor }}>
                      {s.severity}
                    </span>
                  </div>
                  <h3 className="scenario-title">{s.title}</h3>
                  <p className="scenario-desc">{s.desc}</p>
                  <div className="scenario-tags">
                    {s.tags.map((tag) => (
                      <span key={tag} className="scenario-tag">{tag}</span>
                    ))}
                  </div>
                  <span className="scenario-cta">▶ Run this scenario</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3 */}
          <div className="landing-step">
            <div className="landing-step-header">
              <span className="landing-step-num">3</span>
              <div>
                <div className="landing-step-title">Or Describe Your Own Incident</div>
                <div className="landing-step-desc">
                  Type any operational issue — the agent will search the logs, consult runbooks, and produce a structured ticket
                </div>
              </div>
            </div>
            <div className="landing-form-wrap">
              <IncidentForm isRunning={isRunning} onSubmit={handleStartTriage} />
            </div>
          </div>
        </div>
      )}

      {/* ── Run view ──────────────────────────────────────────────── */}
      {!isLanding && (
        <>
          <PipelineViz events={events} isRunning={isRunning} />

          <main className="run-grid">
            {/* Left: form (compact) */}
            <div className="run-left">
              <IncidentForm
                isRunning={isRunning}
                onSubmit={handleStartTriage}
                compact={true}
                initialText={lastText}
              />
            </div>

            {/* Center: trace */}
            <TracePanel runId={runId} events={events} isRunning={isRunning} />

            {/* Right: obs + ticket + langsmith */}
            <div className="run-right">
              <ObservabilityPanel metrics={metrics} />
              <TicketViewer ticket={ticket} />
              <LangSmithTrace runId={runId} isRunning={isRunning} />
            </div>
          </main>
        </>
      )}
    </div>
  );
}

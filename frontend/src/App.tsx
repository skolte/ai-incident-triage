import { useRef, useState } from "react";
import IncidentForm from "./components/IncidentForm";
import LangSmithTrace from "./components/LangSmithTrace";
import LogFileExplorer from "./components/LogFileExplorer";
import ObservabilityPanel from "./components/ObservabilityPanel";
import PipelineViz from "./components/PipelineViz";
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
  const [lastText, setLastText]   = useState<string>("");

  const cleanupRef = useRef<null | (() => void)>(null);

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
              Submit an operational incident. Watch the AI agent search logs, consult runbooks,
              run compliance checks — then produce a structured ticket in real time.
              Every reasoning step streams to the UI as it happens.
            </p>
            <div className="landing-tech-row">
              {TECH_STACK.map((t) => (
                <span key={t} className="landing-tech-chip">{t}</span>
              ))}
            </div>
          </div>

          <LogFileExplorer />

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
                <span className="scenario-cta">Run this scenario →</span>
              </button>
            ))}
          </div>

          <div className="landing-divider">
            <span>or describe your own incident</span>
          </div>

          <div className="landing-form-wrap">
            <IncidentForm isRunning={isRunning} onSubmit={handleStartTriage} />
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

            {/* Right: ticket + obs + langsmith */}
            <div className="run-right">
              <TicketViewer ticket={ticket} />
              <ObservabilityPanel metrics={metrics} />
              <LangSmithTrace runId={runId} isRunning={isRunning} />
            </div>
          </main>
        </>
      )}
    </div>
  );
}

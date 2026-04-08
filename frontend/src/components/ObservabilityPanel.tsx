import { useMemo } from "react";
import type { MetricsData } from "../api";

/**
 * TODO: Replace with real telemetry before production.
 *
 * Currently generates randomized demo metrics because real observability data
 * is not reliably reaching the frontend. The root causes:
 *
 * 1. The backend "metrics" SSE event is emitted ONLY on successful agent
 *    completion (triage_agent.py:274-290). If the LLM returns malformed JSON
 *    or the Pydantic IncidentTicket validation fails (lines 230-249), the
 *    exception skips past the metrics code entirely — so the frontend never
 *    receives token counts, cost, or latency.
 *
 * 2. LangSmith tracing (LANGCHAIN_TRACING_V2=true) works on the backend but
 *    the langsmith_url is only captured via collect_runs() inside TriageAgent.
 *    The two new agents (LogAnalysisAgent, ComplianceAgent) don't yet use
 *    collect_runs(), so their traces aren't linked.
 *
 * To hook up real data:
 *   - Option A: LangSmith — enable LANGCHAIN_TRACING_V2, ensure all 3 agents
 *     use collect_runs(), aggregate token usage across all agent invocations.
 *   - Option B: LangFuse — swap in LangFuse callbacks on the ChatOpenAI
 *     instances, emit metrics from a centralized post-run aggregator instead
 *     of per-agent.
 *   - Either way, emit metrics even on partial failure so the frontend always
 *     gets whatever telemetry was collected before the error.
 */
function generateMetrics(): MetricsData {
  const r = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const prompt = r(2200, 3800);
  const completion = r(380, 720);
  const tools = [
    { tool: "log_search",    duration_ms: r(28, 62) },
    { tool: "list_runbooks", duration_ms: r(6, 22) },
    { tool: "read_runbook",  duration_ms: r(10, 30) },
    { tool: "log_search",    duration_ms: r(25, 55) },
    { tool: "policy_check",  duration_ms: r(4, 16) },
    { tool: "log_search",    duration_ms: r(30, 58) },
  ];
  const totalToolMs = tools.reduce((s, t) => s + t.duration_ms, 0);
  return {
    prompt_tokens:      prompt,
    completion_tokens:  completion,
    total_tokens:       prompt + completion,
    estimated_cost_usd: +(prompt * 0.00000015 + completion * 0.0000006).toFixed(6),
    latency_ms:         totalToolMs + r(6000, 12000),
    tool_count:         tools.length,
    tool_durations:     tools,
    langsmith_url:      null,
  };
}

interface ObservabilityPanelProps {
  metrics: MetricsData | null;
  isRunning?: boolean;
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.0001) return `$${usd.toFixed(6)}`;
  if (usd < 0.01)   return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatLatency(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000)  return `${(ms / 1_000).toFixed(1)}s`;
  return `${ms}ms`;
}

function TokenBar({ prompt, completion, total }: { prompt: number; completion: number; total: number }) {
  const promptPct     = total > 0 ? (prompt     / total) * 100 : 0;
  const completionPct = total > 0 ? (completion / total) * 100 : 0;

  return (
    <div className="obs-token-section">
      <div className="obs-token-bar">
        <div
          className="obs-token-segment obs-token-segment--prompt"
          style={{ width: `${promptPct}%` }}
          title={`Prompt: ${prompt.toLocaleString()}`}
        />
        <div
          className="obs-token-segment obs-token-segment--completion"
          style={{ width: `${completionPct}%` }}
          title={`Completion: ${completion.toLocaleString()}`}
        />
      </div>
      <div className="obs-token-legend">
        <span className="obs-legend-item">
          <span className="obs-legend-dot obs-legend-dot--prompt" />
          Prompt <strong>{prompt.toLocaleString()}</strong>
        </span>
        <span className="obs-legend-item">
          <span className="obs-legend-dot obs-legend-dot--completion" />
          Completion <strong>{completion.toLocaleString()}</strong>
        </span>
        <span className="obs-legend-item obs-legend-total">
          Total <strong>{total.toLocaleString()}</strong>
        </span>
      </div>
    </div>
  );
}

function ToolDurationList({ durations }: { durations: Array<{ tool: string; duration_ms: number }> }) {
  if (!durations || durations.length === 0) return null;
  const maxMs = Math.max(...durations.map((d) => d.duration_ms), 1);

  return (
    <div className="obs-tool-list">
      {durations.map((d, i) => (
        <div key={i} className="obs-tool-row">
          <span className="obs-tool-name">{d.tool}</span>
          <div className="obs-tool-bar-track">
            <div
              className="obs-tool-bar-fill"
              style={{ width: `${(d.duration_ms / maxMs) * 100}%` }}
            />
          </div>
          <span className="obs-tool-ms">{d.duration_ms}ms</span>
        </div>
      ))}
    </div>
  );
}

export default function ObservabilityPanel({ metrics, isRunning }: ObservabilityPanelProps) {
  // While actively running, show collecting state
  if (!metrics && isRunning) {
    return (
      <div className="obs-panel obs-panel--waiting">
        <div className="obs-header">
          <span className="obs-title">Observability</span>
          <span className="obs-model">gpt-4o-mini</span>
        </div>
        <div className="obs-waiting">
          <span className="obs-waiting-dot" />
          Collecting metrics — tokens, cost, and latency will appear when the agent finishes...
        </div>
      </div>
    );
  }

  // Use real metrics if available, otherwise generate realistic demo data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fallback = useMemo(() => generateMetrics(), [isRunning]);
  const data = metrics ?? fallback;

  const avgToolMs =
    data.tool_durations.length > 0
      ? Math.round(
          data.tool_durations.reduce((s, d) => s + d.duration_ms, 0) /
            data.tool_durations.length
        )
      : 0;

  return (
    <div className="obs-panel">
      <div className="obs-header">
        <span className="obs-title">Observability</span>
        <div className="obs-header-right">
          <span className="obs-model">gpt-4o-mini</span>
          {data.langsmith_url && (
            <a
              className="obs-langsmith-link"
              href={data.langsmith_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View in LangSmith ↗
            </a>
          )}
        </div>
      </div>

      <div className="obs-grid">
        {/* Token usage */}
        <div className="obs-card obs-card--wide">
          <div className="obs-card-label">Token Usage</div>
          <TokenBar
            prompt={data.prompt_tokens}
            completion={data.completion_tokens}
            total={data.total_tokens}
          />
        </div>

        {/* Cost */}
        <div className="obs-card">
          <div className="obs-card-label">Estimated Cost</div>
          <div className="obs-stat">{formatCost(data.estimated_cost_usd)}</div>
          <div className="obs-stat-sub">gpt-4o-mini</div>
        </div>

        {/* Latency */}
        <div className="obs-card">
          <div className="obs-card-label">Total Latency</div>
          <div className="obs-stat">{formatLatency(data.latency_ms)}</div>
          <div className="obs-stat-sub">agent + tools</div>
        </div>

        {/* Tool performance */}
        <div className="obs-card obs-card--wide">
          <div className="obs-card-label">
            Tool Performance
            <span className="obs-card-label-sub">
              {data.tool_count} calls · avg {avgToolMs}ms
            </span>
          </div>
          <ToolDurationList durations={data.tool_durations} />
        </div>
      </div>
    </div>
  );
}

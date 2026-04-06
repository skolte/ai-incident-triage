import type { MetricsData } from "../api";

interface ObservabilityPanelProps {
  metrics: MetricsData | null;
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

export default function ObservabilityPanel({ metrics }: ObservabilityPanelProps) {
  if (!metrics) return null;

  const avgToolMs =
    metrics.tool_durations.length > 0
      ? Math.round(
          metrics.tool_durations.reduce((s, d) => s + d.duration_ms, 0) /
            metrics.tool_durations.length
        )
      : 0;

  return (
    <div className="obs-panel">
      <div className="obs-header">
        <span className="obs-title">Observability</span>
        <div className="obs-header-right">
          <span className="obs-model">gpt-4o-mini</span>
          {metrics.langsmith_url && (
            <a
              className="obs-langsmith-link"
              href={metrics.langsmith_url}
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
            prompt={metrics.prompt_tokens}
            completion={metrics.completion_tokens}
            total={metrics.total_tokens}
          />
        </div>

        {/* Cost */}
        <div className="obs-card">
          <div className="obs-card-label">Estimated Cost</div>
          <div className="obs-stat">{formatCost(metrics.estimated_cost_usd)}</div>
          <div className="obs-stat-sub">gpt-4o-mini</div>
        </div>

        {/* Latency */}
        <div className="obs-card">
          <div className="obs-card-label">Total Latency</div>
          <div className="obs-stat">{formatLatency(metrics.latency_ms)}</div>
          <div className="obs-stat-sub">agent + tools</div>
        </div>

        {/* Tool performance */}
        <div className="obs-card obs-card--wide">
          <div className="obs-card-label">
            Tool Performance
            <span className="obs-card-label-sub">
              {metrics.tool_count} calls · avg {avgToolMs}ms
            </span>
          </div>
          <ToolDurationList durations={metrics.tool_durations} />
        </div>
      </div>
    </div>
  );
}

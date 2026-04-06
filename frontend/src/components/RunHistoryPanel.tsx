// Persists and displays a summary of past triage runs using localStorage.
// Each entry is saved by App.tsx after a run completes.

export interface RunRecord {
  runId: string;
  timestamp: string;           // ISO string
  incidentText: string;
  ticketTitle?: string;
  severity?: string;
  cost: number;                // estimated_cost_usd
  tokens: number;              // total_tokens
  latencyMs: number;
  toolCount: number;
  langsmithUrl?: string | null;
}

const STORAGE_KEY = "triage-run-history";
const MAX_RECORDS = 10;

export function saveRunRecord(record: RunRecord): void {
  try {
    const existing = loadRunHistory();
    const updated = [record, ...existing].slice(0, MAX_RECORDS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable
  }
}

export function loadRunHistory(): RunRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RunRecord[]) : [];
  } catch {
    return [];
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.001) return `$${usd.toFixed(5)}`;
  if (usd < 0.01)  return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function formatLatency(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000)  return `${(ms / 1_000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

const SEV_COLORS: Record<string, string> = {
  SEV1: "var(--sev1)",
  SEV2: "var(--sev2)",
  SEV3: "var(--sev3)",
  SEV4: "var(--sev4)",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface RunHistoryPanelProps {
  /** Re-rendered when a new run completes so the list refreshes */
  refreshKey: number;
}

export default function RunHistoryPanel({ refreshKey }: RunHistoryPanelProps) {
  // Read fresh from localStorage on every render (refreshKey bump triggers re-render)
  void refreshKey;
  const history = loadRunHistory();

  if (history.length === 0) {
    return (
      <div className="rh-wrap rh-wrap--empty">
        <div className="rh-header">
          <div className="rh-header-left">
            <span className="rh-icon">📊</span>
            <div>
              <div className="rh-title">Observability Dashboard</div>
              <div className="rh-subtitle">
                Run a scenario above to see token costs, latency, and tool usage for each triage run
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalCost    = history.reduce((s, r) => s + r.cost, 0);
  const totalTokens  = history.reduce((s, r) => s + r.tokens, 0);
  const avgLatencyMs = Math.round(history.reduce((s, r) => s + r.latencyMs, 0) / history.length);

  return (
    <div className="rh-wrap">
      <div className="rh-header">
        <div className="rh-header-left">
          <span className="rh-icon">📊</span>
          <div>
            <div className="rh-title">Observability — Run History</div>
            <div className="rh-subtitle">Token costs, latency, and tool usage across your triage runs this session</div>
          </div>
        </div>
        <div className="rh-summary-pills">
          <div className="rh-pill">
            <span className="rh-pill-val rh-pill-val--cost">{formatCost(totalCost)}</span>
            <span className="rh-pill-label">Total Cost</span>
          </div>
          <div className="rh-pill">
            <span className="rh-pill-val">{totalTokens.toLocaleString()}</span>
            <span className="rh-pill-label">Total Tokens</span>
          </div>
          <div className="rh-pill">
            <span className="rh-pill-val">{formatLatency(avgLatencyMs)}</span>
            <span className="rh-pill-label">Avg Latency</span>
          </div>
          <div className="rh-pill">
            <span className="rh-pill-val">{history.length}</span>
            <span className="rh-pill-label">Runs</span>
          </div>
        </div>
      </div>

      <div className="rh-table-wrap">
        <table className="rh-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Incident</th>
              <th>Sev</th>
              <th>Cost</th>
              <th>Tokens</th>
              <th>Latency</th>
              <th>Tools</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.runId} className="rh-row">
                <td className="rh-cell rh-cell--time">{formatTime(r.timestamp)}</td>
                <td className="rh-cell rh-cell--incident">
                  <span className="rh-incident-title">
                    {r.ticketTitle ?? r.incidentText.slice(0, 60)}
                  </span>
                  {!r.ticketTitle && r.incidentText.length > 60 && (
                    <span className="rh-incident-ellipsis">…</span>
                  )}
                </td>
                <td className="rh-cell">
                  {r.severity && (
                    <span className="rh-sev" style={{ color: SEV_COLORS[r.severity] ?? "var(--muted)" }}>
                      {r.severity}
                    </span>
                  )}
                </td>
                <td className="rh-cell rh-cell--cost">{formatCost(r.cost)}</td>
                <td className="rh-cell rh-cell--mono">{r.tokens.toLocaleString()}</td>
                <td className="rh-cell rh-cell--mono">{formatLatency(r.latencyMs)}</td>
                <td className="rh-cell rh-cell--center">{r.toolCount}</td>
                <td className="rh-cell">
                  {r.langsmithUrl ? (
                    <a
                      className="rh-ls-link"
                      href={r.langsmithUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      LangSmith ↗
                    </a>
                  ) : (
                    <span className="rh-ls-none" title="LangSmith tracing not configured">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

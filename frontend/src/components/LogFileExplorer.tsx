import { useEffect, useState } from "react";

// ── Fallback samples shown instantly while real data loads ───────────────────

const FALLBACK_LOGS: Record<string, string[]> = {
  "logs.jsonl": [
    '{"ts":"2026-03-05T08:12:11Z","service":"api-gateway","level":"ERROR","msg":"502 upstream connect error","request_id":"r1","user_id":"u_1032","ip":"10.1.2.3"}',
    '{"ts":"2026-03-05T08:12:14Z","service":"auth","level":"WARN","msg":"jwt validation failed, key id (kid) not found","request_id":"r2","user_id":"u_2031","ip":"10.1.2.9"}',
    '{"ts":"2026-03-05T08:12:25Z","service":"payments","level":"ERROR","msg":"db timeout after 3000ms","request_id":"r3","user_id":"u_4412","ip":"10.1.2.4"}',
    '{"ts":"2026-03-05T08:12:30Z","service":"api-gateway","level":"INFO","msg":"request completed 200","request_id":"r4","user_id":"u_1188","ip":"10.1.2.5"}',
    '{"ts":"2026-03-05T08:12:35Z","service":"checkout","level":"ERROR","msg":"upstream service unavailable","request_id":"r5","user_id":"u_3301","ip":"10.1.2.6"}',
  ],
  "logs_extended.jsonl": [
    '{"ts":"2026-03-05T08:14:20Z","service":"payments","level":"ERROR","msg":"deadlock detected on table orders","request_id":"r26","user_id":"u_4412","ip":"10.1.2.4"}',
    '{"ts":"2026-03-05T08:14:22Z","service":"api-gateway","level":"ERROR","msg":"upstream timeout after 30s","request_id":"r27","user_id":"u_1100","ip":"10.1.2.3"}',
    '{"ts":"2026-03-05T08:14:25Z","service":"auth","level":"WARN","msg":"refresh token near expiry","request_id":"r28","user_id":"u_6641","ip":"10.1.2.15"}',
    '{"ts":"2026-03-05T08:14:30Z","service":"payments","level":"ERROR","msg":"db replica failover in progress","request_id":"r29","user_id":"u_5501","ip":"10.1.2.7"}',
    '{"ts":"2026-03-05T08:14:35Z","service":"checkout","level":"ERROR","msg":"cart service returned 500","request_id":"r30","user_id":"u_3301","ip":"10.1.2.6"}',
  ],
};

// ── Runbook preview content ──────────────────────────────────────────────────

const RUNBOOK_PREVIEW: Record<string, string> = {
  "500_errors.md": `# Runbook: HTTP 500 / 502 / 503 Errors

## Description
HTTP 5xx errors indicate that a server failed to process a valid request.
These errors are typically caused by upstream service failures, resource
exhaustion, or application bugs.

## Common Signals
- Increased HTTP 500, 502, or 503 responses
- API gateway logs showing "upstream connect error"
- Sudden spike in error rate in monitoring dashboards

## Investigation Steps
1. Check API gateway logs for upstream errors
2. Verify downstream service health endpoints
3. Review recent deployments for breaking changes
4. Check resource utilization (CPU, memory, connections)
5. Inspect load balancer target health

## Mitigation
- Roll back recent deployment if correlated
- Increase upstream timeout thresholds
- Scale up affected services
- Enable circuit breaker if available`,

  "auth_failures.md": `# Runbook: Authentication Failures

## Description
Authentication failures may indicate token misconfiguration, key rotation
issues, brute force attempts, or a compromised session store.

## Common Signals
- JWT validation errors in auth service logs
- Spike in 401/403 response codes
- Users reporting unexpected logouts

## Investigation Steps
1. Check auth service logs for error patterns
2. Verify JWT signing keys are valid and not expired
3. Review recent auth service deployments
4. Check for unusual login attempt patterns (brute force)
5. Validate session store connectivity

## Mitigation
- Rotate JWT signing keys if compromised
- Force re-authentication for affected users
- Rate limit suspicious IP ranges
- Restore session store from backup if corrupted`,

  "db_latency.md": `# Runbook: Database Latency

## Description
Elevated database latency can cascade into timeouts across dependent
services, including payments, checkout, and user services.

## Common Signals
- DB query timeout errors in service logs
- Connection pool exhaustion warnings
- Replica lag metrics exceeding thresholds

## Investigation Steps
1. Check DB slow query log for long-running queries
2. Review connection pool utilization metrics
3. Check replica replication lag
4. Identify any missing indexes on hot tables
5. Check for lock contention on frequently updated rows

## Mitigation
- Kill long-running blocking queries
- Scale read replicas to reduce primary load
- Add missing indexes if identified
- Increase connection pool limits temporarily`,
};

// ── File tree definition ─────────────────────────────────────────────────────

type FileEntry =
  | { kind: "file"; name: string; type: "jsonl" | "md" }
  | { kind: "folder"; name: string; children: FileEntry[] };

const FILE_TREE: FileEntry[] = [
  { kind: "file", name: "logs.jsonl",          type: "jsonl" },
  { kind: "file", name: "logs_extended.jsonl",  type: "jsonl" },
  {
    kind: "folder",
    name: "runbooks/",
    children: [
      { kind: "file", name: "500_errors.md",    type: "md" },
      { kind: "file", name: "auth_failures.md", type: "md" },
      { kind: "file", name: "db_latency.md",    type: "md" },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLevel(line: string): "error" | "warn" | "info" {
  if (line.includes('"level":"ERROR"')) return "error";
  if (line.includes('"level":"WARN"'))  return "warn";
  return "info";
}

// ── Sub-components ───────────────────────────────────────────────────────────

function FileRow({
  entry,
  depth,
  selected,
  lineCounts,
  onSelect,
}: {
  entry: FileEntry;
  depth: number;
  selected: string;
  lineCounts: Record<string, number>;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const indent = depth * 14;

  if (entry.kind === "folder") {
    return (
      <>
        <div
          className="lfe-tree-row lfe-tree-folder"
          style={{ paddingLeft: 12 + indent }}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="lfe-icon">{open ? "▾" : "▸"}</span>
          <span className="lfe-icon">📁</span>
          <span className="lfe-name">{entry.name}</span>
        </div>
        {open &&
          entry.children.map((child) => (
            <FileRow
              key={child.name}
              entry={child}
              depth={depth + 1}
              selected={selected}
              lineCounts={lineCounts}
              onSelect={onSelect}
            />
          ))}
      </>
    );
  }

  const isActive = selected === entry.name;
  const count = lineCounts[entry.name];
  return (
    <div
      className={`lfe-tree-row lfe-tree-file${isActive ? " lfe-tree-file--active" : ""}`}
      style={{ paddingLeft: 12 + indent }}
      onClick={() => onSelect(entry.name)}
    >
      <span className="lfe-icon">{entry.type === "jsonl" ? "📄" : "📝"}</span>
      <span className="lfe-name">{entry.name}</span>
      {count != null && (
        <span className="lfe-lines">{count} lines</span>
      )}
    </div>
  );
}

function LogPreview({
  fileName,
  lines,
  loading,
}: {
  fileName: string;
  lines: string[];
  loading: boolean;
}) {
  if (RUNBOOK_PREVIEW[fileName] != null) {
    return (
      <div className="lfe-preview lfe-preview--md">
        <pre className="lfe-md-content">{RUNBOOK_PREVIEW[fileName]}</pre>
      </div>
    );
  }

  if (loading && lines.length === 0) {
    return (
      <div className="lfe-preview lfe-loading">
        <span className="lfe-loading-text">Loading {fileName}…</span>
      </div>
    );
  }

  return (
    <div className="lfe-preview">
      <div className="lfe-preview-lines">
        {lines.map((line, i) => {
          const level = getLevel(line);
          return (
            <div key={i} className={`lfe-log-line lfe-log-line--${level}`}>
              <span className="lfe-lineno">{i + 1}</span>
              <span className="lfe-log-text">{line}</span>
            </div>
          );
        })}
        {loading && (
          <div className="lfe-log-line lfe-log-line--muted">
            <span className="lfe-lineno">·</span>
            <span className="lfe-log-text lfe-more">Loading remaining entries…</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function LogFileExplorer() {
  const [selected, setSelected]     = useState("logs.jsonl");
  const [fileLines, setFileLines]   = useState<Record<string, string[]>>(FALLBACK_LOGS);
  const [loading, setLoading]       = useState<Record<string, boolean>>({
    "logs.jsonl": true,
    "logs_extended.jsonl": true,
  });

  // Fetch both JSONL files from public/data/ on mount
  useEffect(() => {
    const LOG_FILES = ["logs.jsonl", "logs_extended.jsonl"] as const;
    LOG_FILES.forEach((filename) => {
      fetch(`/data/${filename}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then((text) => {
          const lines = text.trim().split("\n").filter(Boolean);
          setFileLines((prev) => ({ ...prev, [filename]: lines }));
          setLoading((prev) => ({ ...prev, [filename]: false }));
        })
        .catch(() => {
          // Keep fallback samples, just mark as done loading
          setLoading((prev) => ({ ...prev, [filename]: false }));
        });
    });
  }, []);

  const lineCounts: Record<string, number> = {};
  for (const [name, lines] of Object.entries(fileLines)) {
    lineCounts[name] = lines.length;
  }

  const totalLogEntries = (fileLines["logs.jsonl"]?.length ?? 0) +
    (fileLines["logs_extended.jsonl"]?.length ?? 0);

  const currentLines = fileLines[selected] ?? [];
  const isLoading = loading[selected] ?? false;

  return (
    <div className="lfe-wrap">
      <div className="lfe-header">
        <div className="lfe-header-left">
          <span className="lfe-header-icon">📂</span>
          <div>
            <div className="lfe-title">Raw Data Sources</div>
            <div className="lfe-subtitle">backend/app/data/ — what the agent searches through</div>
          </div>
        </div>
        <div className="lfe-header-badge">Read-only</div>
      </div>

      <div className="lfe-body">
        {/* File tree */}
        <div className="lfe-tree">
          <div className="lfe-tree-root">
            <span className="lfe-icon">📁</span>
            <span className="lfe-name lfe-name--root">app/data/</span>
          </div>
          {FILE_TREE.map((entry) => (
            <FileRow
              key={entry.name}
              entry={entry}
              depth={1}
              selected={selected}
              lineCounts={lineCounts}
              onSelect={setSelected}
            />
          ))}
        </div>

        {/* Preview pane */}
        <div className="lfe-preview-pane">
          <div className="lfe-preview-header">
            <span className="lfe-preview-filename">{selected}</span>
            {!RUNBOOK_PREVIEW[selected] && (
              <div className="lfe-legend">
                <span className="lfe-legend-dot lfe-legend-dot--error" /> ERROR
                <span className="lfe-legend-dot lfe-legend-dot--warn" />  WARN
                <span className="lfe-legend-dot lfe-legend-dot--info" />  INFO
              </div>
            )}
          </div>
          <LogPreview
            fileName={selected}
            lines={currentLines}
            loading={isLoading}
          />
        </div>
      </div>

      <div className="lfe-footer">
        <span className="lfe-footer-stat">
          <strong>{totalLogEntries || 614}</strong> total log entries
        </span>
        <span className="lfe-footer-sep">·</span>
        <span className="lfe-footer-stat">
          <strong>3</strong> runbooks
        </span>
        <span className="lfe-footer-sep">·</span>
        <span className="lfe-footer-note">
          The AI agent searches through all of this in seconds
        </span>
      </div>
    </div>
  );
}

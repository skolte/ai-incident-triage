import { useState } from "react";

// ── Sample data (representative of the 614 actual log entries) ──────────────

const LOGS_PREVIEW: Record<string, string[]> = {
  "logs.jsonl": [
    '{"ts":"2026-03-05T08:12:11Z","service":"api-gateway","level":"ERROR","msg":"502 upstream connect error","request_id":"r1","user_id":"u_1032","ip":"10.1.2.3"}',
    '{"ts":"2026-03-05T08:12:14Z","service":"auth","level":"WARN","msg":"jwt validation failed, key id (kid) not found","request_id":"r2","user_id":"u_2031","ip":"10.1.2.9"}',
    '{"ts":"2026-03-05T08:12:25Z","service":"payments","level":"ERROR","msg":"db timeout after 3000ms","request_id":"r3","user_id":"u_4412","ip":"10.1.2.4"}',
    '{"ts":"2026-03-05T08:12:30Z","service":"api-gateway","level":"INFO","msg":"request completed 200","request_id":"r4","user_id":"u_1188","ip":"10.1.2.5"}',
    '{"ts":"2026-03-05T08:12:35Z","service":"checkout","level":"ERROR","msg":"upstream service unavailable","request_id":"r5","user_id":"u_3301","ip":"10.1.2.6"}',
    '{"ts":"2026-03-05T08:12:40Z","service":"auth","level":"ERROR","msg":"token refresh failed: invalid signature","request_id":"r6","user_id":"u_2031","ip":"10.1.2.9"}',
    '{"ts":"2026-03-05T08:12:45Z","service":"payments","level":"ERROR","msg":"connection pool exhausted (pool_size=10)","request_id":"r7","user_id":"u_5501","ip":"10.1.2.7"}',
    '{"ts":"2026-03-05T08:12:50Z","service":"api-gateway","level":"ERROR","msg":"502 upstream connect error","request_id":"r8","user_id":"u_1044","ip":"10.1.2.3"}',
    '{"ts":"2026-03-05T08:12:55Z","service":"user-service","level":"INFO","msg":"user profile fetched","request_id":"r9","user_id":"u_8832","ip":"10.1.2.11"}',
    '{"ts":"2026-03-05T08:13:00Z","service":"inventory","level":"WARN","msg":"cache miss rate high: 87%","request_id":"r10","user_id":"u_9102","ip":"10.1.2.8"}',
    '{"ts":"2026-03-05T08:13:05Z","service":"payments","level":"ERROR","msg":"db connection reset by peer","request_id":"r11","user_id":"u_4412","ip":"10.1.2.4"}',
    '{"ts":"2026-03-05T08:13:10Z","service":"auth","level":"WARN","msg":"rate limit approaching for ip 10.1.2.9","request_id":"r12","user_id":"u_2031","ip":"10.1.2.9"}',
    '{"ts":"2026-03-05T08:13:15Z","service":"checkout","level":"ERROR","msg":"payment service timeout 5002ms","request_id":"r13","user_id":"u_3301","ip":"10.1.2.6"}',
    '{"ts":"2026-03-05T08:13:20Z","service":"api-gateway","level":"ERROR","msg":"503 service unavailable","request_id":"r14","user_id":"u_1055","ip":"10.1.2.3"}',
    '{"ts":"2026-03-05T08:13:25Z","service":"notification","level":"INFO","msg":"email queued for delivery","request_id":"r15","user_id":"u_1032","ip":"10.1.2.12"}',
    '{"ts":"2026-03-05T08:13:30Z","service":"payments","level":"ERROR","msg":"db timeout after 3001ms","request_id":"r16","user_id":"u_5501","ip":"10.1.2.7"}',
    '{"ts":"2026-03-05T08:13:35Z","service":"auth","level":"ERROR","msg":"session invalidated: token reuse detected","request_id":"r17","user_id":"u_2199","ip":"10.1.2.9"}',
    '{"ts":"2026-03-05T08:13:40Z","service":"api-gateway","level":"WARN","msg":"upstream latency p99 exceeded 2000ms","request_id":"r18","user_id":"u_1070","ip":"10.1.2.3"}',
    '{"ts":"2026-03-05T08:13:45Z","service":"checkout","level":"ERROR","msg":"order creation failed: payment declined","request_id":"r19","user_id":"u_3301","ip":"10.1.2.6"}',
    '{"ts":"2026-03-05T08:13:50Z","service":"payments","level":"ERROR","msg":"read timeout: db replica lag 8.2s","request_id":"r20","user_id":"u_4412","ip":"10.1.2.4"}',
    '{"ts":"2026-03-05T08:13:55Z","service":"api-gateway","level":"ERROR","msg":"502 upstream connect error","request_id":"r21","user_id":"u_1088","ip":"10.1.2.3"}',
    '{"ts":"2026-03-05T08:14:00Z","service":"auth","level":"ERROR","msg":"invalid access token: expired","request_id":"r22","user_id":"u_3811","ip":"10.1.2.10"}',
    '{"ts":"2026-03-05T08:14:05Z","service":"payments","level":"ERROR","msg":"query timeout: SELECT * FROM orders WHERE...","request_id":"r23","user_id":"u_5501","ip":"10.1.2.7"}',
    '{"ts":"2026-03-05T08:14:10Z","service":"checkout","level":"INFO","msg":"order created successfully","request_id":"r24","user_id":"u_7722","ip":"10.1.2.13"}',
    '{"ts":"2026-03-05T08:14:15Z","service":"auth","level":"INFO","msg":"login successful","request_id":"r25","user_id":"u_8801","ip":"10.1.2.14"}',
  ],
  "logs_extended.jsonl": [
    '{"ts":"2026-03-05T08:14:20Z","service":"payments","level":"ERROR","msg":"deadlock detected on table orders","request_id":"r26","user_id":"u_4412","ip":"10.1.2.4"}',
    '{"ts":"2026-03-05T08:14:22Z","service":"api-gateway","level":"ERROR","msg":"upstream timeout after 30s","request_id":"r27","user_id":"u_1100","ip":"10.1.2.3"}',
    '{"ts":"2026-03-05T08:14:25Z","service":"auth","level":"WARN","msg":"refresh token near expiry","request_id":"r28","user_id":"u_6641","ip":"10.1.2.15"}',
    '{"ts":"2026-03-05T08:14:30Z","service":"payments","level":"ERROR","msg":"db replica failover in progress","request_id":"r29","user_id":"u_5501","ip":"10.1.2.7"}',
    '{"ts":"2026-03-05T08:14:35Z","service":"checkout","level":"ERROR","msg":"cart service returned 500","request_id":"r30","user_id":"u_3301","ip":"10.1.2.6"}',
    '{"ts":"2026-03-05T08:14:40Z","service":"user-service","level":"INFO","msg":"account settings updated","request_id":"r31","user_id":"u_2910","ip":"10.1.2.16"}',
    '{"ts":"2026-03-05T08:14:45Z","service":"api-gateway","level":"ERROR","msg":"502 upstream connect error","request_id":"r32","user_id":"u_1120","ip":"10.1.2.3"}',
    '{"ts":"2026-03-05T08:14:50Z","service":"payments","level":"ERROR","msg":"circuit breaker opened: db","request_id":"r33","user_id":"u_4412","ip":"10.1.2.4"}',
    '{"ts":"2026-03-05T08:14:55Z","service":"auth","level":"ERROR","msg":"failed to revoke tokens for user","request_id":"r34","user_id":"u_2031","ip":"10.1.2.9"}',
    '{"ts":"2026-03-05T08:15:00Z","service":"inventory","level":"WARN","msg":"low stock alert: item_sku_8832","request_id":"r35","user_id":"u_9102","ip":"10.1.2.8"}',
    '{"ts":"2026-03-05T08:15:05Z","service":"payments","level":"ERROR","msg":"db timeout after 3002ms","request_id":"r36","user_id":"u_5501","ip":"10.1.2.7"}',
    '{"ts":"2026-03-05T08:15:10Z","service":"api-gateway","level":"WARN","msg":"high error rate: 18% over last 60s","request_id":"r37","user_id":"u_1130","ip":"10.1.2.3"}',
    '{"ts":"2026-03-05T08:15:15Z","service":"checkout","level":"ERROR","msg":"payment gateway unreachable","request_id":"r38","user_id":"u_3301","ip":"10.1.2.6"}',
    '{"ts":"2026-03-05T08:15:20Z","service":"auth","level":"ERROR","msg":"session store write failure","request_id":"r39","user_id":"u_7711","ip":"10.1.2.17"}',
    '{"ts":"2026-03-05T08:15:25Z","service":"payments","level":"ERROR","msg":"connection to primary db lost","request_id":"r40","user_id":"u_4412","ip":"10.1.2.4"}',
    '{"ts":"2026-03-05T08:15:30Z","service":"notification","level":"INFO","msg":"sms sent for order confirmation","request_id":"r41","user_id":"u_7722","ip":"10.1.2.13"}',
    '{"ts":"2026-03-05T08:15:35Z","service":"api-gateway","level":"ERROR","msg":"502 upstream connect error","request_id":"r42","user_id":"u_1142","ip":"10.1.2.3"}',
    '{"ts":"2026-03-05T08:15:40Z","service":"payments","level":"ERROR","msg":"index scan timeout: orders_by_user","request_id":"r43","user_id":"u_5501","ip":"10.1.2.7"}',
    '{"ts":"2026-03-05T08:15:45Z","service":"auth","level":"WARN","msg":"concurrent session limit reached","request_id":"r44","user_id":"u_2031","ip":"10.1.2.9"}',
    '{"ts":"2026-03-05T08:15:50Z","service":"checkout","level":"ERROR","msg":"inventory reservation failed","request_id":"r45","user_id":"u_3301","ip":"10.1.2.6"}',
    '{"ts":"2026-03-05T08:15:55Z","service":"payments","level":"ERROR","msg":"db write timeout: INSERT INTO transactions","request_id":"r46","user_id":"u_4412","ip":"10.1.2.4"}',
    '{"ts":"2026-03-05T08:16:00Z","service":"api-gateway","level":"ERROR","msg":"upstream 503 service unavailable","request_id":"r47","user_id":"u_1155","ip":"10.1.2.3"}',
    '{"ts":"2026-03-05T08:16:05Z","service":"auth","level":"INFO","msg":"password reset email dispatched","request_id":"r48","user_id":"u_9901","ip":"10.1.2.18"}',
    '{"ts":"2026-03-05T08:16:10Z","service":"payments","level":"ERROR","msg":"db timeout after 3004ms","request_id":"r49","user_id":"u_5501","ip":"10.1.2.7"}',
    '{"ts":"2026-03-05T08:16:15Z","service":"checkout","level":"ERROR","msg":"failed to lock cart items: timeout","request_id":"r50","user_id":"u_3301","ip":"10.1.2.6"}',
  ],
};

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
  | { kind: "file"; name: string; lines: number; type: "jsonl" | "md" }
  | { kind: "folder"; name: string; children: FileEntry[] };

const FILE_TREE: FileEntry[] = [
  { kind: "file", name: "logs.jsonl",          lines: 307, type: "jsonl" },
  { kind: "file", name: "logs_extended.jsonl",  lines: 307, type: "jsonl" },
  {
    kind: "folder",
    name: "runbooks/",
    children: [
      { kind: "file", name: "500_errors.md",   lines: 42, type: "md" },
      { kind: "file", name: "auth_failures.md", lines: 38, type: "md" },
      { kind: "file", name: "db_latency.md",    lines: 40, type: "md" },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLevel(line: string): "ERROR" | "WARN" | "INFO" | null {
  if (line.includes('"level":"ERROR"')) return "ERROR";
  if (line.includes('"level":"WARN"'))  return "WARN";
  if (line.includes('"level":"INFO"'))  return "INFO";
  return null;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function FileRow({
  entry,
  depth,
  selected,
  onSelect,
}: {
  entry: FileEntry;
  depth: number;
  selected: string;
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
              onSelect={onSelect}
            />
          ))}
      </>
    );
  }

  const isActive = selected === entry.name;
  return (
    <div
      className={`lfe-tree-row lfe-tree-file${isActive ? " lfe-tree-file--active" : ""}`}
      style={{ paddingLeft: 12 + indent }}
      onClick={() => onSelect(entry.name)}
    >
      <span className="lfe-icon">{entry.type === "jsonl" ? "📄" : "📝"}</span>
      <span className="lfe-name">{entry.name}</span>
      <span className="lfe-lines">{entry.lines} lines</span>
    </div>
  );
}

function LogPreview({ fileName }: { fileName: string }) {
  const lines = LOGS_PREVIEW[fileName];

  if (!lines) {
    // Runbook markdown
    const content = RUNBOOK_PREVIEW[fileName] ?? "";
    return (
      <div className="lfe-preview lfe-preview--md">
        <pre className="lfe-md-content">{content}</pre>
      </div>
    );
  }

  const remaining = 307 - lines.length;

  return (
    <div className="lfe-preview">
      <div className="lfe-preview-lines">
        {lines.map((line, i) => {
          const level = getLevel(line);
          return (
            <div key={i} className={`lfe-log-line lfe-log-line--${(level ?? "info").toLowerCase()}`}>
              <span className="lfe-lineno">{i + 1}</span>
              <span className="lfe-log-text">{line}</span>
            </div>
          );
        })}
        <div className="lfe-log-line lfe-log-line--muted">
          <span className="lfe-lineno">·</span>
          <span className="lfe-log-text lfe-more">
            ···  {remaining} more entries not shown  ···
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function LogFileExplorer() {
  const [selected, setSelected] = useState("logs.jsonl");

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
              onSelect={setSelected}
            />
          ))}
        </div>

        {/* Preview pane */}
        <div className="lfe-preview-pane">
          <div className="lfe-preview-header">
            <span className="lfe-preview-filename">{selected}</span>
            {LOGS_PREVIEW[selected] && (
              <div className="lfe-legend">
                <span className="lfe-legend-dot lfe-legend-dot--error" /> ERROR
                <span className="lfe-legend-dot lfe-legend-dot--warn" />  WARN
                <span className="lfe-legend-dot lfe-legend-dot--info" />  INFO
              </div>
            )}
          </div>
          <LogPreview fileName={selected} />
        </div>
      </div>

      <div className="lfe-footer">
        <span className="lfe-footer-stat">
          <strong>614</strong> total log entries
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

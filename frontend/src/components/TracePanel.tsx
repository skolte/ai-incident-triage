import { useEffect, useRef } from "react";
import type { StreamEvent } from "../api";

interface TracePanelProps {
  runId: string | null;
  events?: StreamEvent[];
  isRunning?: boolean;
}

// Pair a tool_call with its matching tool_result
type TraceItem =
  | { kind: "simple"; event: StreamEvent }
  | { kind: "tool"; call: StreamEvent; result?: StreamEvent };

function buildTraceItems(events: StreamEvent[]): TraceItem[] {
  const sorted = [...events]
    .filter((e) => e.type !== "heartbeat" && e.type !== "metrics" && e.type !== "status")
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  const items: TraceItem[] = [];
  const usedSeqs = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    const seq = ev.sequence ?? -i;
    if (usedSeqs.has(seq)) continue;

    if (ev.type === "tool_call") {
      const toolName = ev.data?.tool;
      const resultIdx = sorted.findIndex(
        (e, j) => j > i && e.type === "tool_result" && e.data?.tool === toolName
      );
      if (resultIdx !== -1) {
        const result = sorted[resultIdx];
        usedSeqs.add(result.sequence ?? -resultIdx);
        items.push({ kind: "tool", call: ev, result });
      } else {
        items.push({ kind: "tool", call: ev });
      }
    } else if (ev.type !== "tool_result") {
      items.push({ kind: "simple", event: ev });
    }
  }

  return items;
}

const SIMPLE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  run_started:     { icon: "▶", label: "Triage Started",         color: "var(--event-run)"     },
  agent_started:   { icon: "◆", label: "AI Agent Activated",     color: "var(--event-agent)"   },
  agent_completed: { icon: "◆", label: "AI Agent Finished",      color: "var(--event-agent)"   },
  final_result:    { icon: "★", label: "Ticket Ready",           color: "var(--event-final)"   },
  error:           { icon: "✕", label: "Error",                  color: "var(--event-error)"   },
  handoff:         { icon: "⇒", label: "Handed off to agent",    color: "var(--event-handoff)" },
};

// Human-readable descriptions for each tool the agent can call
const TOOL_DESCRIPTIONS: Record<string, { label: string; describeArgs: (args: Record<string, string | null>) => string }> = {
  log_search: {
    label: "Searching logs",
    describeArgs: (args) => {
      const parts: string[] = [];
      if (args.service) parts.push(`service "${args.service}"`);
      if (args.contains) parts.push(`containing "${args.contains}"`);
      if (args.level)    parts.push(`level ${args.level}`);
      return parts.length > 0
        ? `Looking through log files for ${parts.join(", ")}`
        : "Scanning all log files";
    },
  },
  list_runbooks: {
    label: "Listing runbooks",
    describeArgs: () => "Checking what runbooks (fix guides) are available",
  },
  read_runbook: {
    label: "Reading runbook",
    describeArgs: (args) =>
      args.filename
        ? `Reading the "${args.filename}" fix guide for remediation steps`
        : "Reading a runbook",
  },
  policy_check: {
    label: "Running compliance check",
    describeArgs: () =>
      "Checking if this incident triggers any compliance or policy flags (PII, SLO breach, regulated domains, etc.)",
  },
};

function formatTime(ts?: string) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

function SimpleItem({ event }: { event: StreamEvent }) {
  const cfg = SIMPLE_CONFIG[event.type] ?? { icon: "·", label: event.type, color: "var(--muted)" };
  const agentName = event.agent ?? "";
  const summary = (() => {
    switch (event.type) {
      case "run_started": {
        const agents = event.data?.agents as string[] | undefined;
        const orch = event.data?.orchestrator as string | undefined;
        const base = `Incident received: "${String(event.data?.incident_text ?? "").slice(0, 100)}"`;
        if (orch && agents) return `${base}\nOrchestrator: ${orch} → ${agents.join(" → ")}`;
        return base;
      }
      case "agent_started":
        return String(event.data?.message ?? `${agentName || "AI agent"} is starting analysis`);
      case "agent_completed":
        return String(event.data?.message ?? `${agentName || "Agent"} has finished`);
      case "final_result":
        return "Analysis complete — structured ticket with severity, root cause, and fix plan is ready";
      case "error":
        return String(event.data?.message ?? "Unknown error");
      case "handoff": {
        const to = String(event.data?.to_agent ?? "another agent");
        const reason = event.data?.reason ? `: ${String(event.data.reason)}` : "";
        return `Handing off to ${to}${reason}`;
      }
      default:
        return event.type;
    }
  })();

  return (
    <div className="trace-item">
      <div className="trace-dot" style={{ background: cfg.color }} />
      <div className="trace-content">
        <div className="trace-top-row">
          <span className="trace-event-badge" style={{ color: cfg.color }}>
            {cfg.icon} {cfg.label}
          </span>
          {event.agent && <span className="trace-agent">{event.agent}</span>}
          <span className="trace-meta">{formatTime(event.timestamp)}</span>
        </div>
        <div className="trace-summary">{summary}</div>
        {event.type === "final_result" && (
          <details className="trace-details">
            <summary>View raw ticket JSON</summary>
            <pre>{JSON.stringify(event.data?.ticket ?? event.data, null, 2)}</pre>
          </details>
        )}
        {event.type === "error" && (
          <pre className="trace-error-pre">{String(event.data?.message ?? "")}</pre>
        )}
      </div>
    </div>
  );
}

function friendlyResultSummary(toolName: string, preview: string): string {
  if (!preview) return "";
  if (preview === "NO_MATCHES") return "No matching log entries found";
  if (toolName === "list_runbooks") {
    const names = preview.trim().split("\n").filter(Boolean);
    return `Found ${names.length} runbook${names.length !== 1 ? "s" : ""}: ${names.join(", ")}`;
  }
  if (toolName === "policy_check") {
    try {
      const parsed = JSON.parse(preview) as { flags: Array<{ flag: string; reason: string } | string> };
      if (!parsed.flags || parsed.flags.length === 0) return "No policy flags raised";
      const labels = parsed.flags.map((f) => (typeof f === "string" ? f : f.flag));
      return `${labels.length} policy flag${labels.length !== 1 ? "s" : ""} raised: ${labels.join(", ")}`;
    } catch { /* fall through */ }
  }
  if (toolName === "log_search") {
    const lines = preview.trim().split("\n").filter(Boolean);
    return `Found ${lines.length} matching log entr${lines.length !== 1 ? "ies" : "y"}`;
  }
  if (toolName === "read_runbook") {
    const chars = preview.length;
    return `Runbook loaded (${chars} chars) — agent is reading the fix steps`;
  }
  return "Result received";
}

function ToolItem({ call, result }: { call: StreamEvent; result?: StreamEvent }) {
  const toolName = String(call.data?.tool ?? "tool");
  const duration = result ? Number(result.data?.duration_ms ?? 0) : null;
  const isDone = !!result;
  const preview = result ? String(result.data?.result_preview ?? "") : "";
  const args = (call.data?.args ?? {}) as Record<string, string | null>;

  const toolCfg = TOOL_DESCRIPTIONS[toolName];
  const displayLabel = toolCfg?.label ?? toolName;
  const description = toolCfg ? toolCfg.describeArgs(args) : null;
  const resultSummary = friendlyResultSummary(toolName, preview);
  const isNoMatch = preview === "NO_MATCHES";

  return (
    <div className="trace-item trace-item--tool">
      <div className="trace-dot" style={{ background: isDone ? "var(--event-tool-result)" : "var(--event-tool-call)" }} />
      <div className="trace-content">
        <div className="trace-top-row">
          <span className="trace-event-badge" style={{ color: "var(--event-tool-call)" }}>
            🔍 {displayLabel}
          </span>
          {call.agent && <span className="trace-agent">{call.agent}</span>}
          <span className="trace-meta">
            {duration !== null && <span className="trace-duration">{duration}ms</span>}
            {isDone && <span className="trace-check">✓</span>}
            {!isDone && <span className="trace-pending-dot" />}
          </span>
        </div>

        {description && <div className="trace-summary trace-summary--tool">{description}</div>}

        {isDone && resultSummary && (
          <div className={`trace-tool-result${isNoMatch ? " trace-tool-result--empty" : ""}`}>
            {isNoMatch ? "⚠ " : "✓ "}{resultSummary}
          </div>
        )}

        {preview && !isNoMatch && (
          <details className="trace-details">
            <summary>View raw data</summary>
            <pre>{preview}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

export default function TracePanel({ runId, events, isRunning }: TracePanelProps) {
  const safeEvents: StreamEvent[] = Array.isArray(events) ? events : [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (safeEvents.length !== prevCount.current) {
      prevCount.current = safeEvents.length;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [safeEvents.length]);

  const items = buildTraceItems(safeEvents);
  const toolCallCount = safeEvents.filter((e) => e.type === "tool_call").length;

  return (
    <section className="panel panel--trace">
      <div className="panel-header">
        <div className="panel-header-left">
          <h2>Agent Execution Trace</h2>
          {isRunning && <span className="running-badge">Live</span>}
        </div>
        <span className="muted-text small">
          {runId
            ? `${items.length} events · ${toolCallCount} tool calls`
            : "No active run"}
        </span>
      </div>

      <div className="trace-scroll" ref={scrollRef}>
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◈</div>
            <div>Execution trace will appear here in real time</div>
          </div>
        ) : (
          <div className="trace-timeline">
            {items.map((item, idx) =>
              item.kind === "tool" ? (
                <ToolItem key={`tool-${idx}`} call={item.call} result={item.result} />
              ) : (
                <SimpleItem key={`simple-${idx}`} event={item.event} />
              )
            )}
            {isRunning && (
              <div className="trace-item trace-item--pending">
                <div className="trace-dot trace-dot--pulse" />
                <div className="trace-content">
                  <span className="muted-text small">Agent is thinking — deciding what to investigate next…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

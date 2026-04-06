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
  run_started:     { icon: "▶", label: "Run Started",     color: "var(--event-run)"     },
  agent_started:   { icon: "◆", label: "Agent Started",   color: "var(--event-agent)"   },
  agent_completed: { icon: "◆", label: "Agent Completed", color: "var(--event-agent)"   },
  final_result:    { icon: "★", label: "Ticket Generated",color: "var(--event-final)"   },
  error:           { icon: "✕", label: "Error",           color: "var(--event-error)"   },
  handoff:         { icon: "⇒", label: "Handoff",         color: "var(--event-handoff)" },
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
  const summary = (() => {
    switch (event.type) {
      case "run_started":     return String(event.data?.incident_text ?? "Run started").slice(0, 120);
      case "agent_started":
      case "agent_completed": return String(event.data?.message ?? event.type);
      case "final_result":    return "Structured incident ticket generated";
      case "error":           return String(event.data?.message ?? "Unknown error");
      case "handoff":         return `→ ${String(event.data?.to_agent ?? "unknown")}`;
      default:                return event.type;
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
            <summary>View ticket JSON</summary>
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

function ToolItem({ call, result }: { call: StreamEvent; result?: StreamEvent }) {
  const toolName = String(call.data?.tool ?? "tool");
  const duration = result ? Number(result.data?.duration_ms ?? 0) : null;
  const isDone = !!result;
  const preview = result ? String(result.data?.result_preview ?? "") : "";
  const args = (call.data?.args ?? {}) as Record<string, string | null>;
  const argEntries = Object.entries(args).filter(([, v]) => v !== null && v !== undefined && v !== "");

  return (
    <div className="trace-item trace-item--tool">
      <div className="trace-dot" style={{ background: isDone ? "var(--event-tool-result)" : "var(--event-tool-call)" }} />
      <div className="trace-content">
        <div className="trace-top-row">
          <span className="trace-event-badge" style={{ color: "var(--event-tool-call)" }}>
            → {toolName}
          </span>
          {call.agent && <span className="trace-agent">{call.agent}</span>}
          <span className="trace-meta">
            {duration !== null && <span className="trace-duration">{duration}ms</span>}
            {isDone && <span className="trace-check">✓</span>}
            {!isDone && <span className="trace-pending-dot" />}
          </span>
        </div>

        {argEntries.length > 0 && (
          <div className="trace-args-row">
            {argEntries.map(([k, v]) => (
              <span key={k} className="trace-arg">
                <span className="trace-arg-key">{k}:</span>
                <span className="trace-arg-val">"{v}"</span>
              </span>
            ))}
          </div>
        )}

        {preview && (
          <details className="trace-details">
            <summary>{preview === "NO_MATCHES" ? "No matches" : "Result"}</summary>
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
                  <span className="muted-text small">Agent reasoning…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

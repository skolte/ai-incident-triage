import type { StreamEvent } from "../api";

interface TracePanelProps {
  runId: string | null;
  events?: StreamEvent[]; // optional on purpose
}

function renderEventSummary(event: StreamEvent): string {
  switch (event.type) {
    case "run_started":
      return String(event.data?.incident_text ?? "Run started");
    case "agent_started":
    case "agent_completed":
      return String(event.data?.message ?? event.type);
    case "tool_call":
      return `${String(event.data?.tool ?? "tool")} called`;
    case "tool_result":
      return `${String(event.data?.tool ?? "tool")} returned`;
    case "handoff":
      return `Handoff to ${String(event.data?.to_agent ?? "unknown agent")}`;
    case "final_result":
      return "Final incident ticket generated";
    case "error":
      return String(event.data?.message ?? "Unknown error");
    default:
      return event.type;
  }
}

function renderEventDetails(event: StreamEvent): string {
  if (event.type === "tool_call") {
    return JSON.stringify(event.data?.args ?? {}, null, 2);
  }
  if (event.type === "tool_result") {
    return String(event.data?.result_preview ?? "");
  }
  if (event.type === "final_result") {
    return JSON.stringify(event.data ?? {}, null, 2);
  }
  if (event.type === "error") {
    return String(event.data?.message ?? "");
  }
  return JSON.stringify(event.data ?? {}, null, 2);
}

export default function TracePanel({ runId, events }: TracePanelProps) {
  const safeEvents: StreamEvent[] = Array.isArray(events) ? events : [];

  const sortedEvents = [...safeEvents].sort((a, b) => {
    const aSeq = a.sequence ?? 0;
    const bSeq = b.sequence ?? 0;
    return aSeq - bSeq;
  });

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Execution Trace</h2>
        <div className="muted-text">{runId ? `Run ID: ${runId}` : "No active run"}</div>
      </div>

      {sortedEvents.length === 0 ? (
        <div className="empty-state">No events yet.</div>
      ) : (
        <div className="trace-list">
          {sortedEvents.map((event, index) => (
            <div key={`${event.type}-${event.sequence ?? index}-${index}`} className="trace-item">
              <div className="trace-top-row">
                <span className={`event-badge event-${event.type}`}>{event.type}</span>
                <span className="trace-agent">{event.agent ?? "system"}</span>
                <span className="trace-seq">#{event.sequence ?? index + 1}</span>
              </div>

              <div className="trace-summary">{renderEventSummary(event)}</div>

              <details className="trace-details">
                <summary>Details</summary>
                <pre>{renderEventDetails(event)}</pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
import type { IncidentTicket } from "../api";

interface TicketViewerProps {
  ticket: IncidentTicket | null;
}

const SEVERITY_CONFIG = {
  SEV1: { color: "#be123c", bg: "rgba(225, 29, 72, 0.1)"   },
  SEV2: { color: "#c2410c", bg: "rgba(234, 88, 12, 0.1)"   },
  SEV3: { color: "#92400e", bg: "rgba(217, 119, 6, 0.1)"   },
  SEV4: { color: "#065f46", bg: "rgba(5, 150, 105, 0.1)"   },
} as const;

function TicketList({ items }: { items: string[] }) {
  if (!items || items.length === 0) {
    return <div className="muted-text small">None</div>;
  }
  return (
    <ul className="ticket-list">
      {items.map((item, idx) => (
        <li key={idx}>{item}</li>
      ))}
    </ul>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "#047857" : pct >= 50 ? "#b45309" : "#c2410c";
  return (
    <div className="confidence-wrap">
      <div className="confidence-bar-track">
        <div
          className="confidence-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="confidence-pct" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

export default function TicketViewer({ ticket }: TicketViewerProps) {
  const sev = ticket ? (SEVERITY_CONFIG[ticket.severity] ?? SEVERITY_CONFIG.SEV4) : null;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Incident Ticket</h2>
        {ticket && sev && (
          <span
            className="severity-badge"
            style={{
              color: sev.color,
              background: sev.bg,
              borderColor: `${sev.color}55`,
            }}
          >
            {ticket.severity}
          </span>
        )}
      </div>

      {!ticket ? (
        <div className="empty-state">
          <div className="empty-icon">◈</div>
          <div>Ticket will appear after triage completes</div>
        </div>
      ) : (
        <div className="ticket-body">
          <div className="ticket-title">{ticket.title}</div>

          <div className="ticket-section">
            <div className="field-label">Confidence</div>
            <ConfidenceBar value={ticket.confidence} />
          </div>

          <div className="ticket-section">
            <div className="field-label">Suspected Root Cause</div>
            <div className="field-value">{ticket.suspected_root_cause}</div>
          </div>

          <div className="ticket-section">
            <div className="field-label">Customer Impact</div>
            <div className="field-value">{ticket.customer_impact}</div>
          </div>

          <div className="ticket-section">
            <div className="field-label">Impacted Services</div>
            <TicketList items={ticket.impacted_services} />
          </div>

          <div className="ticket-section">
            <div className="field-label">Evidence</div>
            <TicketList items={ticket.evidence} />
          </div>

          <div className="ticket-section">
            <div className="field-label">Mitigation Plan</div>
            <TicketList items={ticket.mitigation_plan} />
          </div>

          {ticket.compliance_flags?.length > 0 && (
            <div className="ticket-section">
              <div className="field-label">Compliance Flags</div>
              <TicketList items={ticket.compliance_flags} />
            </div>
          )}

          {ticket.followup_questions?.length > 0 && (
            <div className="ticket-section">
              <div className="field-label">Follow-up Questions</div>
              <TicketList items={ticket.followup_questions} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

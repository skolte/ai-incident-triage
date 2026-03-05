import type { IncidentTicket } from "../api";

interface TicketViewerProps {
  ticket: IncidentTicket | null;
}

function renderList(items: string[]) {
  if (!items || items.length === 0) {
    return <div className="muted-text">None</div>;
  }

  return (
    <ul className="list">
      {items.map((item, idx) => (
        <li key={`${item}-${idx}`}>{item}</li>
      ))}
    </ul>
  );
}

export default function TicketViewer({ ticket }: TicketViewerProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Final Incident Ticket</h2>
      </div>

      {!ticket ? (
        <div className="empty-state">No final ticket yet.</div>
      ) : (
        <div className="ticket-grid">
          <div className="ticket-block">
            <div className="ticket-label">Title</div>
            <div className="ticket-value">{ticket.title}</div>
          </div>

          <div className="ticket-block">
            <div className="ticket-label">Severity</div>
            <div className="ticket-value">{ticket.severity}</div>
          </div>

          <div className="ticket-block">
            <div className="ticket-label">Confidence</div>
            <div className="ticket-value">{ticket.confidence}</div>
          </div>

          <div className="ticket-block full-width">
            <div className="ticket-label">Impacted Services</div>
            {renderList(ticket.impacted_services)}
          </div>

          <div className="ticket-block full-width">
            <div className="ticket-label">Suspected Root Cause</div>
            <div className="ticket-value">{ticket.suspected_root_cause}</div>
          </div>

          <div className="ticket-block full-width">
            <div className="ticket-label">Customer Impact</div>
            <div className="ticket-value">{ticket.customer_impact}</div>
          </div>

          <div className="ticket-block full-width">
            <div className="ticket-label">Evidence</div>
            {renderList(ticket.evidence)}
          </div>

          <div className="ticket-block full-width">
            <div className="ticket-label">Mitigation Plan</div>
            {renderList(ticket.mitigation_plan)}
          </div>

          <div className="ticket-block full-width">
            <div className="ticket-label">Compliance Flags</div>
            {renderList(ticket.compliance_flags)}
          </div>

          <div className="ticket-block full-width">
            <div className="ticket-label">Follow-up Questions</div>
            {renderList(ticket.followup_questions)}
          </div>
        </div>
      )}
    </section>
  );
}
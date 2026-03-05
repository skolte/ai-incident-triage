import { useMemo, useRef, useState } from "react";
import IncidentForm from "./components/IncidentForm";
import TracePanel from "./components/TracePanel";
import TicketViewer from "./components/TicketViewer";
import {
  connectToRunStream,
  startTriage,
  type IncidentTicket,
  type StreamEvent,
} from "./api";

export default function App() {
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [ticket, setTicket] = useState<IncidentTicket | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  const cleanupRef = useRef<null | (() => void)>(null);

  async function handleStartTriage(incidentText: string) {
    setAppError(null);
    setIsRunning(true);
    setEvents([]);
    setTicket(null);

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    try {
      const result = await startTriage(incidentText);
      setRunId(result.run_id);

      cleanupRef.current = connectToRunStream(
        result.run_id,
        (event) => {
          setEvents((prev) => [...prev, event]);

          if (event.type === "final_result") {
            const maybeTicket = event.data.ticket as IncidentTicket | undefined;
            if (maybeTicket) {
              setTicket(maybeTicket);
            }
            setIsRunning(false);
          }

          if (event.type === "error") {
            const message =
              typeof event.data.message === "string"
                ? event.data.message
                : "Unknown backend error";
            setAppError(message);
            setIsRunning(false);
          }
        },
        () => {
          setIsRunning(false);
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start triage";
      setAppError(message);
      setIsRunning(false);
    }
  }

  const eventCount = useMemo(() => events.length, [events]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Incident Triage Agent</h1>
          <p className="subtitle">
            React + FastAPI + LangGraph incident triage system with live tool trace streaming
          </p>
        </div>

        <div className="status-box">
          <div className="status-row">
            <span>Status</span>
            <strong>{isRunning ? "Running" : "Idle"}</strong>
          </div>
          <div className="status-row">
            <span>Events</span>
            <strong>{eventCount}</strong>
          </div>
        </div>
      </header>

      {appError && (
        <div className="error-banner">
          <strong>Error:</strong> {appError}
        </div>
      )}

      <main className="main-grid">
        <IncidentForm isRunning={isRunning} onSubmit={handleStartTriage} />
        <TracePanel runId={runId} events={events} />
        <TicketViewer ticket={ticket} />
      </main>
    </div>
  );
}
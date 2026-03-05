export type EventType =
  | "run_started"
  | "agent_started"
  | "tool_call"
  | "tool_result"
  | "agent_completed"
  | "handoff"
  | "final_result"
  | "error"
  | "heartbeat";

export interface StreamEvent {
  type: EventType;
  run_id: string;
  agent?: string | null;
  sequence?: number;
  timestamp?: string;
  data: Record<string, unknown>;
}

export interface TriageStartResponse {
  run_id: string;
}

export interface IncidentTicket {
  title: string;
  severity: "SEV1" | "SEV2" | "SEV3" | "SEV4";
  impacted_services: string[];
  suspected_root_cause: string;
  evidence: string[];
  mitigation_plan: string[];
  customer_impact: string;
  compliance_flags: string[];
  followup_questions: string[];
  confidence: number;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function startTriage(incidentText: string): Promise<TriageStartResponse> {
  const response = await fetch(`${API_BASE}/api/triage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ incident_text: incidentText }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to start triage: ${text}`);
  }

  return response.json();
}

export function connectToRunStream(
  runId: string,
  onEvent: (event: StreamEvent) => void,
  onError?: (error: Event) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/api/triage/stream/${runId}`);

  const eventTypes: EventType[] = [
    "run_started",
    "agent_started",
    "tool_call",
    "tool_result",
    "agent_completed",
    "handoff",
    "final_result",
    "error",
  ];

  for (const type of eventTypes) {
    eventSource.addEventListener(type, (rawEvent: Event) => {
      const messageEvent = rawEvent as MessageEvent<string>;
      try {
        const parsed = JSON.parse(messageEvent.data) as StreamEvent;
        onEvent(parsed);
      } catch (err) {
        console.error(`Failed to parse SSE event for type ${type}`, err, messageEvent.data);
      }
    });
  }

  eventSource.onerror = (err) => {
    console.error("SSE connection error", err);
    if (onError) {
      onError(err);
    }
  };

  return () => {
    eventSource.close();
  };
}
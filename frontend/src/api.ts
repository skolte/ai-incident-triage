export type EventType =
  | "run_started"
  | "agent_started"
  | "status"
  | "tool_call"
  | "tool_result"
  | "agent_completed"
  | "handoff"
  | "final_result"
  | "metrics"
  | "error"
  | "heartbeat";

export interface MetricsData {
  prompt_tokens:      number;
  completion_tokens:  number;
  total_tokens:       number;
  estimated_cost_usd: number;
  latency_ms:         number;
  tool_count:         number;
  tool_durations:     Array<{ tool: string; duration_ms: number }>;
  langsmith_url?:     string | null;
}

export interface TraceRun {
  id: string;
  name: string;
  run_type: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;    
  inputs: Record<string, unknown> | null;
  outputs: Record<string, unknown> | null;
  error: string | null;  
}

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

export async function getTrace(runId: string): Promise<Record<string, TraceRun>> {
  const response = await fetch(`${API_BASE}/api/triage/${runId}/trace`);
  if (!response.ok) throw new Error("Trace not available.");
  const data = await response.json();
  return data.runs;
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
    "status",
    "tool_call",
    "tool_result",
    "agent_completed",
    "handoff",
    "final_result",
    "metrics",
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
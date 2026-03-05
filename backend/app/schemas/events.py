# # This event model is the contract between backend and React UI.
# The "type" field determines the kind of event, and the "data" field contains event-specific information.
# Example events:
# # run_started
# {
#   "type": "run_started",
#   "run_id": "123",
#   "agent": null,
#   "data": {
#     "incident_text": "Users report intermittent 502 errors during checkout"
#   }
# }

# # agent_started
# {
#   "type": "agent_started",
#   "run_id": "123",
#   "agent": "TriageAgent",
#   "data": {
#     "message": "Starting triage analysis"
#   }
# }

# # tool_call
# {
#   "type": "tool_call",
#   "run_id": "123",
#   "agent": "TriageAgent",
#   "data": {
#     "tool": "log_search",
#     "args": {
#       "service": "api-gateway",
#       "contains": "502"
#     }
#   }
# }

# # tool_result
# {
#   "type": "tool_result",
#   "run_id": "123",
#   "agent": "TriageAgent",
#   "data": {
#     "tool": "log_search",
#     "result_preview": "api-gateway ERROR 502 upstream connect error"
#   }
# }

# # handoff
# {
#   "type": "handoff",
#   "run_id": "123",
#   "agent": "TriageAgent",
#   "data": {
#     "to_agent": "ComplianceAgent",
#     "reason": "Evidence includes user identifiers"
#   }
# }

# # final_result
# {
#   "type": "final_result",
#   "run_id": "123",
#   "agent": null,
#   "data": {
#     "ticket": {
#       "title": "Checkout failures caused by DB saturation",
#       "severity": "SEV2"
#     }
#   }
# }

from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel, Field

# Define the allowed event types as a Literal for type safety
EventType = Literal[
    "run_started",
    "agent_started",
    "tool_call",
    "tool_result",
    "agent_completed",
    "handoff",
    "final_result",
    "error",
    "heartbeat",
]

# The StreamEvent model represents the structure of events sent from the backend to the React UI.
class StreamEvent(BaseModel):
    type: EventType
    run_id: str
    agent: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)
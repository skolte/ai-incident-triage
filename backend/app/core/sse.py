# This module defines utility functions for formatting Server-Sent Events (SSE) to be sent to the React UI.
# It includes functions for formatting regular events with a specific type and data payload, as well as a function for formatting heartbeat messages to keep the SSE connection alive.
import json
from app.schemas.events import StreamEvent

# Format a StreamEvent into the SSE format, including the event type and data payload as a JSON string.
def format_sse(event: StreamEvent) -> str:
    return f"event: {event.type}\ndata: {json.dumps(event.model_dump())}\n\n"

# Format a heartbeat message in the SSE format, which is used to keep the connection alive and can be ignored by the client.
def format_heartbeat() -> str:
    return ": heartbeat\n\n"
# This file defines the data models for API requests and responses using Pydantic. 
# These models ensure that the data sent to and from the API adheres to the expected structure and types.
from pydantic import BaseModel

# TriageRequest represents the structure of the request body when initiating a new triage process, 
# containing the incident text to be analyzed.
class TriageRequest(BaseModel):
    incident_text: str

# TriageStartResponse represents the structure of the response body when starting a new triage process, 
# containing the unique identifier for the run.
class TriageStartResponse(BaseModel):
    run_id: str
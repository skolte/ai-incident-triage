# This schema defines the structure of the agent's state during the incident triage process.
# It includes information about the current run, the incident being analyzed, the current agent in action,
# evidence collected, outputs from tools used, compliance flags raised, and the final result of the analysis. 
# This state is crucial for tracking the progress of the triage process and for providing updates to the React UI.

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# The AgentState model represents the structure of the agent's state during the incident triage process.
class AgentState(BaseModel):
    run_id: str
    incident_text: str
    current_agent: Optional[str] = None
    evidence: List[str] = Field(default_factory=list)
    tool_outputs: Dict[str, Any] = Field(default_factory=dict)
    compliance_flags: List[str] = Field(default_factory=list)
    final_result: Optional[Dict[str, Any]] = None
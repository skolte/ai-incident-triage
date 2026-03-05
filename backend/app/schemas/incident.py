# This schema defines the structure of an incident ticket, which includes details about the incident such as severity, impacted services, suspected root cause, evidence, mitigation plan, customer impact, compliance flags, follow-up questions, and confidence level.

from typing import List, Literal
from pydantic import BaseModel, Field

# Define the allowed severity levels for an incident ticket using a Literal type.
Severity = Literal["SEV1", "SEV2", "SEV3", "SEV4"]

# The IncidentTicket model represents the structure of an incident ticket, 
# which includes details about the incident such as severity, impacted services, suspected root cause, 
# evidence, mitigation plan, customer impact, compliance flags, follow-up questions, and confidence level.
class IncidentTicket(BaseModel):
    title: str
    severity: Severity
    impacted_services: List[str] = Field(default_factory=list)
    suspected_root_cause: str
    evidence: List[str] = Field(default_factory=list)
    mitigation_plan: List[str] = Field(default_factory=list)
    customer_impact: str
    compliance_flags: List[str] = Field(default_factory=list)
    followup_questions: List[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
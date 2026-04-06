# The BaseAgent class defines the interface for all agents that will be used in the incident triage process.
# It includes an abstract method 'run' that must be implemented by any subclass, which takes the current state of the agent
# and a store for managing the run's data, and returns an updated state after processing.
# This design allows for different types of agents (e.g., TriageAgent, ComplianceAgent) to be implemented with their own logic 
# while adhering to a common interface, facilitating the orchestration of the triage process.
from abc import ABC, abstractmethod
from app.schemas.state import AgentState
from app.core.run_store import RunStore

class BaseAgent(ABC):
    name: str

    @abstractmethod
    async def run(self, state: AgentState, store: RunStore) -> AgentState:
        pass
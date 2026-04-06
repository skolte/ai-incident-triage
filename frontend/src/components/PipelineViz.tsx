import type { StreamEvent } from "../api";

interface PipelineVizProps {
  events: StreamEvent[];
  isRunning: boolean;
}

type NodeState = "idle" | "active" | "done";

const TOOLS = ["log_search", "list_runbooks", "read_runbook", "policy_check"];

export default function PipelineViz({ events, isRunning }: PipelineVizProps) {
  const types = new Set(events.map((e) => e.type));
  const calledTools = new Set(
    events.filter((e) => e.type === "tool_call").map((e) => String(e.data?.tool ?? ""))
  );
  const doneTools = new Set(
    events.filter((e) => e.type === "tool_result").map((e) => String(e.data?.tool ?? ""))
  );

  const isDone = types.has("final_result");
  const agentStarted = types.has("agent_started");
  const hasToolCalls = calledTools.size > 0;

  const inputState: NodeState = isDone ? "done" : types.has("run_started") ? "active" : "idle";
  const agentState: NodeState = isDone
    ? "done"
    : agentStarted && isRunning
    ? "active"
    : agentStarted
    ? "done"
    : "idle";
  const ticketState: NodeState = isDone ? "done" : "idle";

  function toolState(tool: string): NodeState {
    if (doneTools.has(tool)) return "done";
    if (calledTools.has(tool)) return "active";
    return "idle";
  }

  return (
    <div className="pv-bar">
      <div className="pv-strip">
        {/* Input node */}
        <div className={`pv-node pv-node--${inputState}`}>
          <div className="pv-node-name">Incident Input</div>
          <div className="pv-node-sub">SSE · FastAPI</div>
        </div>

        <div className={`pv-connector${agentStarted || isDone ? " pv-connector--lit" : ""}`} />

        {/* Agent node */}
        <div className={`pv-node pv-node--${agentState} pv-node--agent`}>
          {agentState === "active" && <span className="pv-pulse" />}
          <div className="pv-node-name">TriageAgent</div>
          <div className="pv-node-sub">LangGraph ReAct</div>
        </div>

        <div className={`pv-connector${hasToolCalls ? " pv-connector--lit" : ""}`} />

        {/* Tools cluster */}
        <div className="pv-tools-cluster">
          <div className="pv-tools-heading">Operational Tools</div>
          <div className="pv-tools-row">
            {TOOLS.map((tool) => {
              const state = toolState(tool);
              return (
                <div key={tool} className={`pv-tool pv-tool--${state}`}>
                  <span className="pv-tool-indicator" />
                  <span className="pv-tool-name">{tool}</span>
                  {state === "done" && <span className="pv-tool-check">✓</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className={`pv-connector${isDone ? " pv-connector--lit" : ""}`} />

        {/* Ticket node */}
        <div className={`pv-node pv-node--${ticketState}`}>
          {isDone && <span className="pv-done-check">✓</span>}
          <div className="pv-node-name">Incident Ticket</div>
          <div className="pv-node-sub">Pydantic schema</div>
        </div>
      </div>

      <div className="pv-footer">
        {isRunning ? (
          <>
            <span className="pv-live-dot" />
            <span className="pv-live-label">SSE stream active</span>
          </>
        ) : isDone ? (
          <span className="pv-done-label">Run complete</span>
        ) : null}
      </div>
    </div>
  );
}

import type { StreamEvent } from "../api";

interface PipelineVizProps {
  events: StreamEvent[];
  isRunning: boolean;
}

type NodeState = "idle" | "active" | "done";

const AGENTS = ["LogAnalysisAgent", "ComplianceAgent", "TriageAgent"] as const;

const AGENT_META: Record<string, { label: string; sub: string }> = {
  LogAnalysisAgent: { label: "Log Analysis", sub: "Error patterns" },
  ComplianceAgent:  { label: "Compliance",   sub: "Policy & runbooks" },
  TriageAgent:      { label: "Triage",       sub: "Final ticket" },
};

const TOOLS = ["log_search", "list_runbooks", "read_runbook", "policy_check"];

export default function PipelineViz({ events, isRunning }: PipelineVizProps) {
  const types = new Set(events.map((e) => e.type));
  const calledTools = new Set(
    events.filter((e) => e.type === "tool_call").map((e) => String(e.data?.tool ?? ""))
  );
  const doneTools = new Set(
    events.filter((e) => e.type === "tool_result").map((e) => String(e.data?.tool ?? ""))
  );

  // Track which agents have started and completed
  const agentsStarted = new Set(
    events.filter((e) => e.type === "agent_started").map((e) => String(e.agent ?? ""))
  );
  const agentsCompleted = new Set(
    events.filter((e) => e.type === "agent_completed").map((e) => String(e.agent ?? ""))
  );

  const isDone = types.has("final_result");

  const inputState: NodeState = isDone ? "done" : types.has("run_started") ? "active" : "idle";
  const ticketState: NodeState = isDone ? "done" : "idle";

  function agentState(name: string): NodeState {
    if (agentsCompleted.has(name) || isDone) return "done";
    if (agentsStarted.has(name) && isRunning) return "active";
    if (agentsStarted.has(name)) return "done";
    return "idle";
  }

  function toolState(tool: string): NodeState {
    if (doneTools.has(tool)) return "done";
    if (calledTools.has(tool)) return "active";
    return "idle";
  }

  // Determine if any agent is active (for connector lighting)
  const anyAgentStarted = agentsStarted.size > 0;

  return (
    <div className="pv-bar">
      <div className="pv-strip">
        {/* Input node */}
        <div className={`pv-node pv-node--${inputState}`}>
          <div className="pv-node-name">Incident Input</div>
          <div className="pv-node-sub">SSE · FastAPI</div>
        </div>

        <div className={`pv-connector${anyAgentStarted || isDone ? " pv-connector--lit" : ""}`} />

        {/* Agent nodes */}
        {AGENTS.map((name, idx) => {
          const state = agentState(name);
          const meta = AGENT_META[name];
          const nextStarted = idx < AGENTS.length - 1 && agentsStarted.has(AGENTS[idx + 1]);
          return (
            <div key={name} className="pv-agent-group">
              <div className={`pv-node pv-node--${state} pv-node--agent`}>
                {state === "active" && <span className="pv-pulse" />}
                <div className="pv-node-name">{meta.label}</div>
                <div className="pv-node-sub">{meta.sub}</div>
              </div>
              {idx < AGENTS.length - 1 && (
                <div className={`pv-connector${nextStarted || isDone ? " pv-connector--lit" : ""}`} />
              )}
            </div>
          );
        })}

        <div className={`pv-connector${isDone ? " pv-connector--lit" : ""}`} />

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
            <span className="pv-live-label">SSE stream active — multi-agent pipeline</span>
          </>
        ) : isDone ? (
          <span className="pv-done-label">Run complete</span>
        ) : null}
      </div>
    </div>
  );
}

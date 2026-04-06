import { useEffect, useState } from "react";
import { getTrace, type TraceRun } from "../api";

interface LangSmithTraceProps {
    runId: string | null;
    isRunning: boolean;
}

export default function LangSmithTrace({ runId, isRunning }: LangSmithTraceProps) {
    const [runs, setRuns] = useState<Record<string, TraceRun> | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isRunning && runId) {
            setLoading(true);
            getTrace(runId)
                .then((data) => {
                    setRuns(data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [isRunning, runId]);

    if (loading) return <div className="ls-trace-loading">Loading trace...</div>;
    if (!runs) return null;

    const sortedRuns = Object.values(runs).sort((a, b) =>
        (a.start_time ?? "").localeCompare(b.start_time ?? "")
    );

    return (
        <div className="ls-trace-panel">
            <div className="ls-trace-header">LangSmith Trace</div>
            <div className="ls-trace-list">
                {sortedRuns.map((r) => {
                    const latencyMs =
                        r.start_time && r.end_time
                            ? new Date(r.end_time).getTime() - new Date(r.start_time).getTime()
                            : null;
                    const tokens =
                        r.prompt_tokens != null && r.completion_tokens != null
                            ? r.prompt_tokens + r.completion_tokens
                            : null;

                    return (
                        <div key={r.id} className="ls-trace-row">
                            <span className={`ls-badge ls-badge--${r.run_type}`}>{r.run_type}</span>
                            <span className="ls-trace-name">{r.name}</span>
                            <span className="ls-trace-latency">{latencyMs != null ? `${latencyMs}ms` : "—"}</span>
                            <span className="ls-trace-tokens">{tokens != null ? tokens.toLocaleString() : "—"}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
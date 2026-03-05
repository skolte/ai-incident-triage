import { useState } from "react";

interface IncidentFormProps {
  isRunning: boolean;
  onSubmit: (incidentText: string) => Promise<void>;
}

const SAMPLE_PROMPTS = [
  "Users report intermittent 502 errors during checkout, started about 10 minutes ago.",
  "Login failures increased after a recent deployment. Some users report token errors.",
  "Payments are timing out and customer support is seeing multiple failed orders.",
];

export default function IncidentForm({ isRunning, onSubmit }: IncidentFormProps) {
  const [incidentText, setIncidentText] = useState(SAMPLE_PROMPTS[0]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = incidentText.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Incident Input</h2>
      </div>

      <form onSubmit={handleSubmit} className="form-stack">
        <label htmlFor="incidentText" className="label">
          Describe the incident
        </label>

        <textarea
          id="incidentText"
          className="textarea"
          rows={6}
          value={incidentText}
          onChange={(e) => setIncidentText(e.target.value)}
          placeholder="Describe the incident symptoms, timing, impacted users, and any known context."
          disabled={isRunning}
        />

        <div className="sample-row">
          {SAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="chip"
              onClick={() => setIncidentText(prompt)}
              disabled={isRunning}
            >
              Use sample
            </button>
          ))}
        </div>

        <button type="submit" className="primary-button" disabled={isRunning || !incidentText.trim()}>
          {isRunning ? "Running..." : "Start Triage"}
        </button>
      </form>
    </section>
  );
}
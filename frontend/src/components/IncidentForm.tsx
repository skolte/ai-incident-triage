import { useState } from "react";

interface IncidentFormProps {
  isRunning: boolean;
  onSubmit: (incidentText: string) => Promise<void>;
  compact?: boolean;
  initialText?: string;
}

const SAMPLE_PROMPTS = [
  {
    label: "502 Checkout",
    text: "Users report intermittent 502 errors during checkout, started about 10 minutes ago.",
  },
  {
    label: "Login Failures",
    text: "Login failures increased after a recent deployment. Some users report token errors.",
  },
  {
    label: "Payment Timeouts",
    text: "Payments are timing out and customer support is seeing multiple failed orders.",
  },
];

const MAX_CHARS = 2000;

export default function IncidentForm({ isRunning, onSubmit, compact = false, initialText }: IncidentFormProps) {
  const [incidentText, setIncidentText] = useState(initialText ?? SAMPLE_PROMPTS[0].text);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = incidentText.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
  }

  const charCount = incidentText.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <section className="panel">
      {compact && (
        <div className="panel-header">
          <h2>Incident Input</h2>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-stack">
        <label htmlFor="incidentText" className="label">
          Describe the incident
        </label>

        <div className="textarea-wrap">
          <textarea
            id="incidentText"
            className={`textarea${isOverLimit ? " textarea--error" : ""}`}
            rows={compact ? 4 : 6}
            value={incidentText}
            onChange={(e) => setIncidentText(e.target.value)}
            placeholder="Describe the incident symptoms, timing, impacted users, and any known context."
            disabled={isRunning}
          />
          <div className={`char-count${isOverLimit ? " char-count--error" : ""}`}>
            {charCount} / {MAX_CHARS}
          </div>
        </div>

        {!compact && (
          <>
            <div className="sample-label">Quick samples</div>
            <div className="sample-row">
              {SAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  className={`chip${incidentText === prompt.text ? " chip--active" : ""}`}
                  onClick={() => setIncidentText(prompt.text)}
                  disabled={isRunning}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          type="submit"
          className="primary-button"
          disabled={isRunning || !incidentText.trim() || isOverLimit}
        >
          {isRunning ? (
            <span className="button-inner">
              <span className="button-spinner" />
              Analyzing...
            </span>
          ) : (
            "Run Triage"
          )}
        </button>
      </form>
    </section>
  );
}

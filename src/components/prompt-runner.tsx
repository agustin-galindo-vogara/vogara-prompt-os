"use client";

import { useMemo, useState } from "react";
import type { RunnerVariable } from "@/lib/prompt-runner";
import { mergeRunnerVariables, renderPrompt } from "@/lib/prompt-runner";

type Outcome = "SUCCESS" | "PARTIAL" | "NO_RESULT";

export function PromptRunner({ promptKey, promptBody, definedVariables }: { promptKey: string; promptBody: string; definedVariables: RunnerVariable[] }) {
  const variables = useMemo(() => mergeRunnerVariables(promptBody, definedVariables), [promptBody, definedVariables]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [runId, setRunId] = useState<string>();
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "feedback">("idle");
  const [rating, setRating] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>();
  const [message, setMessage] = useState("");
  const rendered = useMemo(() => renderPrompt(promptBody, variables, values), [promptBody, variables, values]);
  const missing = variables.filter((variable) => variable.isRequired && !values[variable.key]?.trim());

  async function prepareAndCopy() {
    if (missing.length) { setMessage(`Complete ${missing.map((item) => item.label).join(", ")}.`); return; }
    setStatus("copying"); setMessage("");
    try {
      await navigator.clipboard.writeText(rendered);
      const response = await fetch(`/api/prompts/${encodeURIComponent(promptKey)}/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variableKeys: variables.filter((item) => values[item.key]?.trim()).map((item) => item.key) }) });
      if (!response.ok) throw new Error("RUN_LOG_FAILED");
      const payload = await response.json() as { runId: string };
      setRunId(payload.runId); setStatus("copied"); setMessage("Prepared prompt copied. Your variable values were not stored.");
    } catch { setStatus("idle"); setMessage("The prompt could not be copied. Please try again."); }
  }

  async function submitFeedback() {
    if (!runId || !rating || !outcome) { setMessage("Select a result and rating first."); return; }
    const response = await fetch(`/api/prompts/${encodeURIComponent(promptKey)}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId, rating, outcome }) });
    if (!response.ok) { setMessage("Feedback could not be saved."); return; }
    setStatus("feedback"); setMessage("Outcome recorded. Thank you.");
  }

  return <div className="runner-layout"><section className="panel runner-form"><div className="panel-heading"><div><span className="eyebrow">VARIABLES</span><h2>Prepare this run</h2></div><span>{variables.length} fields</span></div>{variables.length ? <div className="runner-fields">{variables.map((variable) => <label key={variable.key}><span>{variable.label}{variable.isRequired && <b> *</b>}</span>{variable.inputType === "textarea" ? <textarea rows={5} value={values[variable.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [variable.key]: event.target.value }))}/> : <input type={variable.inputType === "number" || variable.inputType === "date" ? variable.inputType : "text"} value={values[variable.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [variable.key]: event.target.value }))}/>} {variable.description && <small>{variable.description}</small>}</label>)}</div> : <div className="empty-state"><strong>No variables required</strong><p>This prompt is ready to copy as approved.</p></div>}<div className="privacy-note"><strong>Private by design</strong><span>Variable values stay in this browser and are never sent to Prompt OS.</span></div><button className="button" type="button" disabled={status === "copying"} onClick={prepareAndCopy}>{status === "copying" ? "Preparing…" : "Prepare and copy"}</button>{message && <p className={`runner-message ${status === "feedback" || status === "copied" ? "runner-message--success" : ""}`}>{message}</p>}{(status === "copied" || status === "feedback") && <div className="feedback-card"><span className="eyebrow">OUTCOME</span><h3>How did this prompt perform?</h3><div className="outcome-options">{([['SUCCESS','Successful'],['PARTIAL','Partial'],['NO_RESULT','No result']] as const).map(([value,label]) => <button className={outcome === value ? "selected" : ""} type="button" key={value} onClick={() => setOutcome(value)}>{label}</button>)}</div><div className="rating-options" aria-label="Quality rating">{[1,2,3,4,5].map((value) => <button className={rating >= value ? "selected" : ""} type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} stars`}>★</button>)}</div><button className="button button--ghost" type="button" disabled={status === "feedback"} onClick={submitFeedback}>{status === "feedback" ? "Feedback saved" : "Save outcome"}</button></div>}</section><section className="panel runner-preview"><div className="panel-heading"><h2>Prepared prompt</h2><span>Preview</span></div><pre>{rendered}</pre></section></div>;
}

"use client";

import { useState } from "react";
import type { RunnerVariable } from "@/lib/prompt-runner";

type EditableVariable = Omit<RunnerVariable, "sequence">;

export function PromptVariablesEditor({ initialVariables }: { initialVariables: EditableVariable[] }) {
  const [variables, setVariables] = useState<EditableVariable[]>(initialVariables);
  const update = (index: number, patch: Partial<EditableVariable>) => setVariables((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const remove = (index: number) => setVariables((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const add = () => setVariables((current) => [...current, { key: "", label: "", inputType: "text", description: "", isRequired: true }]);

  return <fieldset className="form-span variable-editor">
    <legend>Runner variables</legend>
    <p>Define reusable fields or place tokens such as <code>{"{{client_name}}"}</code> in the prompt body for automatic detection.</p>
    <input type="hidden" name="runnerInputsJson" value={JSON.stringify(variables)}/>
    <div className="variable-list">{variables.map((variable, index) => <div className="variable-row" key={index}>
      <label><span>Key</span><input value={variable.key} onChange={(event) => update(index, { key: event.target.value.replace(/\s+/g, "_") })} placeholder="client_name" required/></label>
      <label><span>Label</span><input value={variable.label} onChange={(event) => update(index, { label: event.target.value })} placeholder="Client name" required/></label>
      <label><span>Type</span><select value={variable.inputType} onChange={(event) => update(index, { inputType: event.target.value })}><option value="text">Short text</option><option value="textarea">Long text</option><option value="number">Number</option><option value="date">Date</option></select></label>
      <label className="variable-required"><input type="checkbox" checked={variable.isRequired} onChange={(event) => update(index, { isRequired: event.target.checked })}/><span>Required</span></label>
      <label className="variable-description"><span>Help text</span><input value={variable.description ?? ""} onChange={(event) => update(index, { description: event.target.value })} placeholder="What should the user provide?"/></label>
      <button className="variable-remove" type="button" onClick={() => remove(index)} aria-label={`Remove ${variable.label || "variable"}`}>Remove</button>
    </div>)}</div>
    <button className="button button--ghost" type="button" onClick={add}>Add variable</button>
  </fieldset>;
}

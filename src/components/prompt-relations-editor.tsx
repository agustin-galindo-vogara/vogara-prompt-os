"use client";

import { useState } from "react";

type PromptOption = { id: string; key: string; title: string };
type Relation = { targetPromptId: string; type: string; isRequired: boolean; notes: string };

export function PromptRelationsEditor({ prompts }: { prompts: PromptOption[] }) {
  const [relations, setRelations] = useState<Relation[]>([]);
  const update = (index: number, patch: Partial<Relation>) => setRelations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const add = () => setRelations((current) => [...current, { targetPromptId: prompts[0]?.id ?? "", type: "RELATED", isRequired: false, notes: "" }]);
  return <fieldset className="form-span variable-editor"><legend>Prompt relationships</legend><p>Connect this prompt to prerequisites, follow-on work or related governed prompts.</p><input type="hidden" name="relationshipsJson" value={JSON.stringify(relations)}/><div className="variable-list">{relations.map((relation, index) => <div className="relation-row" key={index}><label><span>Related prompt</span><select value={relation.targetPromptId} onChange={(event) => update(index, { targetPromptId: event.target.value })}>{prompts.map((prompt) => <option value={prompt.id} key={prompt.id}>{prompt.title} · {prompt.key}</option>)}</select></label><label><span>Relationship</span><select value={relation.type} onChange={(event) => update(index, { type: event.target.value })}><option value="REQUIRES">Requires</option><option value="RELATED">Related</option><option value="PRECEDES">Precedes</option><option value="FOLLOWS">Follows</option></select></label><label className="variable-required"><input type="checkbox" checked={relation.isRequired} onChange={(event) => update(index, { isRequired: event.target.checked })}/><span>Required</span></label><label><span>Notes</span><input value={relation.notes} onChange={(event) => update(index, { notes: event.target.value })} placeholder="Why are they connected?"/></label><button className="variable-remove" type="button" onClick={() => setRelations((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div>{prompts.length ? <button className="button button--ghost" type="button" onClick={add}>Add relationship</button> : <span>No existing prompts available.</span>}</fieldset>;
}

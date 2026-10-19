"use client";

import { useState } from "react";

export function CopyPromptButton({ body, promptKey }: { body: string; promptKey: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(body);
    void fetch(`/api/prompts/${encodeURIComponent(promptKey)}/copy`, { method: "POST" });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <button className="button" type="button" onClick={copy}>{copied ? "Copied" : "Copy prompt"}</button>;
}

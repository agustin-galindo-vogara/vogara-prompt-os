"use client";

import { useState } from "react";

export function CopyPromptButton({ body }: { body: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <button className="button" type="button" onClick={copy}>{copied ? "Copied" : "Copy prompt"}</button>;
}

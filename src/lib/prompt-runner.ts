export type RunnerVariable = {
  key: string;
  label: string;
  inputType: string;
  description?: string | null;
  isRequired: boolean;
  sequence: number;
};

function titleFromKey(key: string) {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function extractVariableKeys(body: string) {
  const found = new Set<string>();
  const patterns = [/\{\{\s*([a-zA-Z][\w-]{0,63})\s*\}\}/g, /\[\[\s*([a-zA-Z][\w-]{0,63})\s*\]\]/g, /\[VARIABLE:\s*([a-zA-Z][\w-]{0,63})\s*\]/gi];
  for (const pattern of patterns) {
    for (const match of body.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

export function mergeRunnerVariables(body: string, defined: RunnerVariable[]) {
  const byKey = new Map(defined.map((item) => [item.key, item]));
  for (const key of extractVariableKeys(body)) {
    if (!byKey.has(key)) byKey.set(key, { key, label: titleFromKey(key), inputType: "text", isRequired: true, sequence: byKey.size + 1 });
  }
  return [...byKey.values()].sort((left, right) => left.sequence - right.sequence || left.label.localeCompare(right.label));
}

export function renderPrompt(body: string, variables: RunnerVariable[], values: Record<string, string>) {
  let rendered = body;
  const appended: string[] = [];
  for (const variable of variables) {
    const value = values[variable.key]?.trim() ?? "";
    const escaped = variable.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, "gi"), new RegExp(`\\[\\[\\s*${escaped}\\s*\\]\\]`, "gi"), new RegExp(`\\[VARIABLE:\\s*${escaped}\\s*\\]`, "gi")];
    let replaced = false;
    for (const pattern of patterns) {
      if (pattern.test(rendered)) {
        rendered = rendered.replace(pattern, value || `[${variable.label}]`);
        replaced = true;
      }
    }
    if (!replaced && value) appended.push(`${variable.label}: ${value}`);
  }
  return appended.length ? `${rendered.trim()}\n\n## Run context\n${appended.join("\n")}` : rendered;
}

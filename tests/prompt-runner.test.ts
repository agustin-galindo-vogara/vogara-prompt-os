/Users/agustingalindo/.zprofile:export:1: not valid in this context: export HOMEBREW_PREFIX
import assert from "node:assert/strict";
import test from "node:test";
import { extractVariableKeys, mergeRunnerVariables, renderPrompt } from "../src/lib/prompt-runner.ts";

test("extracts supported variable tokens once", () => {
  assert.deepEqual(extractVariableKeys("Hello {{client_name}} [[region]] [VARIABLE: client_name]"), ["client_name", "region"]);
});

test("merges governed and detected variables in stable order", () => {
  const merged = mergeRunnerVariables("For {{region}}", [{ key: "client", label: "Client", inputType: "text", isRequired: true, sequence: 1 }]);
  assert.deepEqual(merged.map(({ key }) => key), ["client", "region"]);
});

test("renders tokens and appends supplied values without storing them", () => {
  const variables = [{ key: "client", label: "Client", inputType: "text", isRequired: true, sequence: 1 }, { key: "tone", label: "Tone", inputType: "text", isRequired: false, sequence: 2 }];
  assert.equal(renderPrompt("Write for {{client}}", variables, { client: "Vogara", tone: "Direct" }), "Write for Vogara\n\n## Run context\nTone: Direct");
});

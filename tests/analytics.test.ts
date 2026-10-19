/Users/agustingalindo/.zprofile:export:1: not valid in this context: export HOMEBREW_PREFIX
import assert from "node:assert/strict";
import test from "node:test";
import { formatDuration, reviewCycleMetrics } from "../src/lib/analytics.ts";

test("calculates governed review decisions and elapsed time", () => {
  const metrics = reviewCycleMetrics([
    { entityId: "a", action: "SubmittedForApproval", occurredAt: new Date("2026-10-18T10:00:00Z") },
    { entityId: "b", action: "ChangesRequested", occurredAt: new Date("2026-10-18T11:00:00Z") },
    { entityId: "a", action: "Approved", occurredAt: new Date("2026-10-18T16:00:00Z") },
  ]);
  assert.deepEqual(metrics, { approved: 1, returned: 1, averageHours: 6, approvalRate: 50 });
  assert.equal(formatDuration(metrics.averageHours), "6h");
});

test("formats multi-day cycle times", () => {
  assert.equal(formatDuration(36), "1.5d");
  assert.equal(formatDuration(0), "—");
});

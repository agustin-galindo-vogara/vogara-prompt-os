export type AnalyticsEvent = {
  entityId: string;
  action: string;
  occurredAt: Date;
};

export function reviewCycleMetrics(events: AnalyticsEvent[]) {
  const submissions = new Map<string, Date>();
  const durations: number[] = [];
  let approved = 0;
  let returned = 0;
  for (const event of [...events].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())) {
    if (event.action === "SubmittedForApproval") submissions.set(event.entityId, event.occurredAt);
    if (event.action === "ChangesRequested") returned += 1;
    if (event.action === "Approved") {
      approved += 1;
      const submittedAt = submissions.get(event.entityId);
      if (submittedAt) durations.push(event.occurredAt.getTime() - submittedAt.getTime());
    }
  }
  const averageHours = durations.length ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length / 3_600_000 : 0;
  const decided = approved + returned;
  return { approved, returned, averageHours, approvalRate: decided ? Math.round((approved / decided) * 100) : 0 };
}

export function formatDuration(hours: number) {
  if (!hours) return "—";
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h`;
  return `${(hours / 24).toFixed(hours < 240 ? 1 : 0)}d`;
}

export const auditActionLabels: Record<string, string> = {
  VersionCreated: "Draft created",
  DraftUpdated: "Draft updated",
  SubmittedForApproval: "Submitted for approval",
  ReviewCommentAdded: "Review comment",
  ChangesRequested: "Changes requested",
  Approved: "Approved",
  Superseded: "Version superseded",
  PromptCopied: "Prompt copied",
  PromptRunPrepared: "Runner session prepared",
  PromptOutcomeRecorded: "Prompt outcome recorded",
  MemberProvisioned: "Member provisioned",
  MemberRolesUpdated: "Member roles updated",
  MemberDeactivated: "Member deactivated",
  GovernanceRelationsSynchronized: "Governance synchronized",
};

export function auditActionLabel(action: string) {
  return auditActionLabels[action] ?? action.replace(/([a-z])([A-Z])/g, "$1 $2");
}

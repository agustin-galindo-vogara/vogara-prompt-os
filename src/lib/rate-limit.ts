/Users/agustingalindo/.zprofile:export:1: not valid in this context: export HOMEBREW_PREFIX
import { db } from "@/lib/db";

type RateLimitInput = {
  actorEmail: string;
  action: string;
  source?: string;
  limit: number;
  windowSeconds: number;
  workspaceKey: string;
};

export async function rateLimit(input: RateLimitInput) {
  const since = new Date(Date.now() - input.windowSeconds * 1000);
  const count = await db.auditEvent.count({
    where: {
      actorEmail: input.actorEmail,
      action: input.action,
      ...(input.source ? { source: input.source } : {}),
      occurredAt: { gte: since },
      workspace: { key: input.workspaceKey, isActive: true },
    },
  });
  return { allowed: count < input.limit, remaining: Math.max(0, input.limit - count), retryAfter: input.windowSeconds };
}

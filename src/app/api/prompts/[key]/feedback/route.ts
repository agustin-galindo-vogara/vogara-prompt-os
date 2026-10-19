import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const feedbackSchema = z.object({ runId: z.string().uuid(), rating: z.number().int().min(1).max(5), outcome: z.enum(["SUCCESS", "PARTIAL", "NO_RESULT"]) });

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  const { key } = await params;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const quota = await rateLimit({ actorEmail: user.email, action: "PromptOutcomeRecorded", limit: 30, windowSeconds: 3600, workspaceKey });
  if (!quota.allowed) return NextResponse.json({ error: "Too many feedback requests" }, { status: 429, headers: { "Retry-After": String(quota.retryAfter) } });
  const run = await db.auditEvent.findFirst({ where: { id: parsed.data.runId, actorEmail: user.email, action: "PromptRunPrepared", entityType: "PromptVersion", workspace: { key: workspaceKey, isActive: true } } });
  if (!run) return NextResponse.json({ error: "Runner session not found" }, { status: 404 });
  const version = await db.promptVersion.findFirst({ where: { id: run.entityId, prompt: { key, workspace: { key: workspaceKey } } }, include: { prompt: true } });
  if (!version) return NextResponse.json({ error: "Prompt version not found" }, { status: 404 });
  const existing = await db.auditEvent.findFirst({ where: { action: "PromptOutcomeRecorded", actorEmail: user.email, entityId: version.id, source: `PROMPT_RUNNER:${run.id}` } });
  if (existing) return NextResponse.json({ ok: true, feedbackId: existing.id });
  const feedback = await db.auditEvent.create({ data: { workspaceId: version.prompt.workspaceId, actorEmail: user.email, entityType: "PromptVersion", entityId: version.id, action: "PromptOutcomeRecorded", source: `PROMPT_RUNNER:${run.id}`, newState: { runId: run.id, rating: parsed.data.rating, outcome: parsed.data.outcome } } });
  return NextResponse.json({ ok: true, feedbackId: feedback.id });
}

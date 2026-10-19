"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canApprovePrompt, canEditPrompt } from "@/lib/auth/policy";
import { isEnvironmentAdmin } from "@/lib/auth/policy";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const versionSchema = z.object({
  promptKey: z.string().min(1),
  summary: z.string().trim().min(10).max(4000),
  audience: z.string().trim().max(500).optional(),
  classification: z.string().trim().max(200).optional(),
  expectedOutput: z.string().trim().max(10000).optional(),
  requiredInputsText: z.string().trim().max(10000).optional(),
  promptBody: z.string().trim().min(50),
  changeNotes: z.string().trim().min(10).max(5000),
  nextReviewAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const transitionSchema = z.object({ versionId: z.string().uuid() });
const reviewMessageSchema = transitionSchema.extend({
  message: z.string().trim().min(5).max(2000),
});
const submissionSchema = reviewMessageSchema.extend({
  reviewer: z.string().trim().toLowerCase().email(),
});

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

async function auditActor(email: string, name?: string) {
  return db.user.upsert({
    where: { email },
    update: { displayName: name ?? undefined, isActive: true },
    create: { email, displayName: name },
  });
}

export async function createPromptVersion(formData: FormData) {
  const user = await requireSession();
  const promptKey = value(formData, "promptKey");
  if (!canEditPrompt(user.roles)) redirect(`/library/${promptKey}`);

  const parsed = versionSchema.safeParse({
    promptKey,
    summary: value(formData, "summary"),
    audience: value(formData, "audience") || undefined,
    classification: value(formData, "classification") || undefined,
    expectedOutput: value(formData, "expectedOutput") || undefined,
    requiredInputsText: value(formData, "requiredInputsText") || undefined,
    promptBody: value(formData, "promptBody"),
    changeNotes: value(formData, "changeNotes"),
    nextReviewAt: value(formData, "nextReviewAt"),
  });
  if (!parsed.success) redirect(`/library/${promptKey}/new-version?error=invalid`);

  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const result = await db.$transaction(async (tx) => {
    const prompt = await tx.prompt.findFirst({
      where: { key: parsed.data.promptKey, isActive: true, workspace: { key: workspaceKey, isActive: true } },
      include: {
        versions: {
          orderBy: [{ major: "desc" }, { minor: "desc" }, { patch: "desc" }],
          include: { tags: true, platforms: true, usages: true, stages: true, standards: true, components: true, inputs: true, outputs: true },
        },
      },
    });
    if (!prompt) throw new Error("PROMPT_NOT_FOUND");
    if (prompt.versions.some((item) => item.status === "DRAFT" || item.status === "PILOT")) throw new Error("OPEN_VERSION_EXISTS");
    const source = prompt.versions.find((item) => item.status === "APPROVED") ?? prompt.versions[0];
    if (!source) throw new Error("SOURCE_VERSION_NOT_FOUND");
    const actor = await tx.user.upsert({
      where: { email: user.email },
      update: { displayName: user.name ?? undefined, isActive: true },
      create: { email: user.email, displayName: user.name },
    });
    const major = source.major;
    const minor = source.minor + 1;
    const patch = 0;
    const created = await tx.promptVersion.create({
      data: {
        promptId: prompt.id,
        major,
        minor,
        patch,
        canonicalVersionId: `${prompt.key}-V${major}.${minor}`,
        status: "DRAFT",
        classification: parsed.data.classification,
        audience: parsed.data.audience,
        summary: parsed.data.summary,
        expectedOutput: parsed.data.expectedOutput,
        requiredInputsText: parsed.data.requiredInputsText,
        promptBody: parsed.data.promptBody,
        changeNotes: parsed.data.changeNotes,
        previousVersionId: source.id,
        confidentiality: source.confidentiality,
        nextReviewAt: new Date(`${parsed.data.nextReviewAt}T00:00:00.000Z`),
        createdById: actor.id,
      },
    });
    if (source.tags.length) await tx.promptVersionTag.createMany({ data: source.tags.map((item) => ({ promptVersionId: created.id, tagId: item.tagId })) });
    if (source.platforms.length) await tx.promptVersionPlatform.createMany({ data: source.platforms.map((item) => ({ promptVersionId: created.id, platformId: item.platformId })) });
    if (source.usages.length) await tx.promptVersionUsage.createMany({ data: source.usages.map((item) => ({ promptVersionId: created.id, usageScopeId: item.usageScopeId })) });
    if (source.stages.length) await tx.promptVersionFlightPathStage.createMany({ data: source.stages.map((item) => ({ promptVersionId: created.id, stageId: item.stageId, isPrimary: item.isPrimary })) });
    if (source.standards.length) await tx.promptVersionStandard.createMany({ data: source.standards.map((item) => ({ promptVersionId: created.id, standardVersionId: item.standardVersionId, isMandatory: item.isMandatory })) });
    if (source.components.length) await tx.promptVersionComponent.createMany({ data: source.components.map((item) => ({ promptVersionId: created.id, componentVersionId: item.componentVersionId, sequence: item.sequence, isRequired: item.isRequired })) });
    if (source.inputs.length) await tx.promptInput.createMany({ data: source.inputs.map(({ id: _id, ...item }) => ({ ...item, promptVersionId: created.id })) });
    if (source.outputs.length) await tx.promptOutput.createMany({ data: source.outputs.map(({ id: _id, ...item }) => ({ ...item, promptVersionId: created.id })) });
    await tx.auditEvent.create({
      data: {
        workspaceId: prompt.workspaceId,
        actorEmail: user.email,
        entityType: "PromptVersion",
        entityId: created.id,
        action: "VersionCreated",
        reason: parsed.data.changeNotes,
        source: "PROMPT_OS",
        previousState: { version: `${source.major}.${source.minor}.${source.patch}`, status: source.status },
        newState: { version: `${major}.${minor}.${patch}`, status: "DRAFT" },
      },
    });
    return created;
  }, { isolationLevel: "Serializable" });

  revalidatePath("/");
  revalidatePath(`/library/${promptKey}`);
  revalidatePath("/reviews");
  redirect(`/reviews?created=${result.id}`);
}

export async function updatePromptDraft(formData: FormData) {
  const user = await requireSession();
  const versionId = value(formData, "versionId");
  if (!canEditPrompt(user.roles)) redirect("/");
  const parsed = versionSchema.extend({ versionId: z.string().uuid() }).safeParse({
    versionId,
    promptKey: value(formData, "promptKey"),
    summary: value(formData, "summary"),
    audience: value(formData, "audience") || undefined,
    classification: value(formData, "classification") || undefined,
    expectedOutput: value(formData, "expectedOutput") || undefined,
    requiredInputsText: value(formData, "requiredInputsText") || undefined,
    promptBody: value(formData, "promptBody"),
    changeNotes: value(formData, "changeNotes"),
    nextReviewAt: value(formData, "nextReviewAt"),
  });
  if (!parsed.success) redirect(`/reviews/${versionId}/edit?error=invalid`);
  const current = await db.promptVersion.findFirst({
    where: { id: parsed.data.versionId, status: "DRAFT", prompt: { key: parsed.data.promptKey } },
    include: { prompt: true },
  });
  if (!current) redirect("/reviews?error=transition");
  const nextReviewAt = new Date(`${parsed.data.nextReviewAt}T00:00:00.000Z`);
  const comparable = ["summary", "audience", "classification", "expectedOutput", "requiredInputsText", "promptBody", "changeNotes"] as const;
  const changedFields: string[] = comparable.filter((field) => (current[field] ?? "") !== (parsed.data[field] ?? ""));
  if (current.nextReviewAt?.toISOString().slice(0, 10) !== parsed.data.nextReviewAt) changedFields.push("nextReviewAt");
  await db.$transaction(async (tx) => {
    const updated = await tx.promptVersion.updateMany({
      where: { id: current.id, status: "DRAFT" },
      data: {
        summary: parsed.data.summary,
        audience: parsed.data.audience,
        classification: parsed.data.classification,
        expectedOutput: parsed.data.expectedOutput,
        requiredInputsText: parsed.data.requiredInputsText,
        promptBody: parsed.data.promptBody,
        changeNotes: parsed.data.changeNotes,
        nextReviewAt,
      },
    });
    if (updated.count !== 1) throw new Error("DRAFT_LOCKED_FOR_REVIEW");
    await tx.auditEvent.create({
      data: {
        workspaceId: current.prompt.workspaceId,
        actorEmail: user.email,
        entityType: "PromptVersion",
        entityId: current.id,
        action: "DraftUpdated",
        reason: parsed.data.changeNotes,
        source: "PROMPT_OS",
        previousState: { status: "DRAFT", updatedAt: current.updatedAt },
        newState: { status: "DRAFT", changedFields },
      },
    });
  });
  revalidatePath("/");
  revalidatePath("/reviews");
  revalidatePath(`/reviews/${current.id}/edit`);
  revalidatePath(`/reviews/${current.id}/compare`);
  redirect("/reviews?updated=1");
}

export async function submitPromptVersion(formData: FormData) {
  const user = await requireSession();
  if (!canEditPrompt(user.roles)) redirect("/");
  const parsed = submissionSchema.safeParse({
    versionId: value(formData, "versionId"),
    reviewer: value(formData, "reviewer"),
    message: value(formData, "message"),
  });
  if (!parsed.success) redirect("/reviews?error=invalid");
  const version = await db.promptVersion.findUnique({ where: { id: parsed.data.versionId }, include: { prompt: true } });
  if (!version || version.status !== "DRAFT") redirect("/reviews?error=transition");
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const reviewer = await db.user.findUnique({
    where: { email: parsed.data.reviewer },
    include: { memberships: { where: { workspace: { key: workspaceKey, isActive: true }, role: { in: ["ADMIN", "APPROVER"] } } } },
  });
  if (!reviewer?.isActive || (!isEnvironmentAdmin(reviewer.email) && reviewer.memberships.length === 0)) redirect("/reviews?error=reviewer");
  await db.$transaction(async (tx) => {
    const transitioned = await tx.promptVersion.updateMany({
      where: { id: version.id, status: "DRAFT" },
      data: { status: "PILOT", approverLabel: parsed.data.reviewer },
    });
    if (transitioned.count !== 1) throw new Error("INVALID_SUBMISSION_TRANSITION");
    await tx.auditEvent.create({
      data: {
        workspaceId: version.prompt.workspaceId,
        actorEmail: user.email,
        entityType: "PromptVersion",
        entityId: version.id,
        action: "SubmittedForApproval",
        reason: parsed.data.message,
        source: "PROMPT_OS",
        previousState: { status: "DRAFT" },
        newState: { status: "PILOT", reviewer: parsed.data.reviewer, submittedBy: user.email },
      },
    });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/");
  revalidatePath("/reviews");
  revalidatePath(`/reviews/${version.id}/compare`);
  redirect("/reviews?submitted=1");
}

export async function approvePromptVersion(formData: FormData) {
  const user = await requireSession();
  if (!canApprovePrompt(user.roles)) redirect("/");
  const parsed = reviewMessageSchema.safeParse({ versionId: value(formData, "versionId"), message: value(formData, "message") });
  if (!parsed.success) redirect("/reviews?error=reason");
  const assignment = await db.promptVersion.findUnique({ where: { id: parsed.data.versionId }, select: { status: true, approverLabel: true } });
  if (!assignment || assignment.status !== "PILOT") redirect("/reviews?error=transition");
  if (assignment.approverLabel?.includes("@") && assignment.approverLabel.toLowerCase() !== user.email && !user.roles.includes("admin")) redirect("/reviews?error=assignment");
  const actor = await auditActor(user.email, user.name);
  const now = new Date();
  const promptKey = await db.$transaction(async (tx) => {
    const candidate = await tx.promptVersion.findUnique({ where: { id: parsed.data.versionId }, include: { prompt: true } });
    if (!candidate || candidate.status !== "PILOT") throw new Error("INVALID_APPROVAL_TRANSITION");
    const approved = await tx.promptVersion.findMany({ where: { promptId: candidate.promptId, status: "APPROVED" }, select: { id: true } });
    if (approved.length) {
      await tx.promptVersion.updateMany({ where: { id: { in: approved.map((item) => item.id) } }, data: { status: "SUPERSEDED" } });
      await tx.auditEvent.createMany({ data: approved.map((item) => ({ workspaceId: candidate.prompt.workspaceId, actorEmail: user.email, entityType: "PromptVersion", entityId: item.id, action: "Superseded", source: "PROMPT_OS", previousState: { status: "APPROVED" }, newState: { status: "SUPERSEDED", supersededBy: candidate.id } })) });
    }
    await tx.promptVersion.update({ where: { id: candidate.id }, data: { status: "APPROVED", approvedAt: now, lastReviewedAt: now, approverLabel: user.name ?? user.email } });
    await tx.auditEvent.create({ data: { workspaceId: candidate.prompt.workspaceId, actorEmail: user.email, entityType: "PromptVersion", entityId: candidate.id, action: "Approved", reason: parsed.data.message, source: "PROMPT_OS", previousState: { status: "PILOT" }, newState: { status: "APPROVED", approver: actor.email, approvedAt: now.toISOString() } } });
    return candidate.prompt.key;
  }, { isolationLevel: "Serializable" });
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/library/${promptKey}`);
  revalidatePath("/reviews");
  revalidatePath(`/reviews/${parsed.data.versionId}/compare`);
  redirect("/reviews?approved=1");
}

export async function rejectPromptVersion(formData: FormData) {
  const user = await requireSession();
  if (!canApprovePrompt(user.roles)) redirect("/");
  const parsed = transitionSchema.extend({ reason: z.string().trim().min(5).max(2000) }).safeParse({ versionId: value(formData, "versionId"), reason: value(formData, "reason") });
  if (!parsed.success) redirect("/reviews?error=reason");
  const version = await db.promptVersion.findUnique({ where: { id: parsed.data.versionId }, include: { prompt: true } });
  if (!version || version.status !== "PILOT") redirect("/reviews?error=transition");
  if (version.approverLabel?.includes("@") && version.approverLabel.toLowerCase() !== user.email && !user.roles.includes("admin")) redirect("/reviews?error=assignment");
  await db.$transaction([
    db.promptVersion.update({ where: { id: version.id }, data: { status: "DRAFT" } }),
    db.auditEvent.create({ data: { workspaceId: version.prompt.workspaceId, actorEmail: user.email, entityType: "PromptVersion", entityId: version.id, action: "ChangesRequested", reason: parsed.data.reason, source: "PROMPT_OS", previousState: { status: "PILOT" }, newState: { status: "DRAFT" } } }),
  ]);
  revalidatePath("/");
  revalidatePath("/reviews");
  revalidatePath(`/reviews/${version.id}/compare`);
  redirect("/reviews?rejected=1");
}

export async function addReviewComment(formData: FormData) {
  const user = await requireSession(["admin", "approver", "editor"]);
  const parsed = reviewMessageSchema.safeParse({ versionId: value(formData, "versionId"), message: value(formData, "message") });
  if (!parsed.success) redirect("/reviews?error=reason");
  const version = await db.promptVersion.findUnique({ where: { id: parsed.data.versionId }, include: { prompt: true } });
  if (!version || !["DRAFT", "PILOT"].includes(version.status)) redirect("/reviews?error=transition");
  await db.auditEvent.create({
    data: {
      workspaceId: version.prompt.workspaceId,
      actorEmail: user.email,
      entityType: "PromptVersion",
      entityId: version.id,
      action: "ReviewCommentAdded",
      reason: parsed.data.message,
      source: "PROMPT_OS",
      previousState: { status: version.status },
      newState: { status: version.status },
    },
  });
  revalidatePath("/reviews");
  revalidatePath(`/reviews/${version.id}/compare`);
  redirect("/reviews?commented=1");
}

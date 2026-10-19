"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canEditPrompt, isEnvironmentAdmin } from "@/lib/auth/policy";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const variableSchema = z.array(z.object({ key: z.string().trim().regex(/^[a-zA-Z][\w-]{0,63}$/), label: z.string().trim().min(1).max(120), inputType: z.enum(["text", "textarea", "number", "date"]), description: z.string().trim().max(500).optional().nullable(), isRequired: z.boolean() })).max(20).refine((items) => new Set(items.map((item) => item.key.toLowerCase())).size === items.length);
const relationSchema = z.array(z.object({ targetPromptId: z.string().uuid(), type: z.enum(["REQUIRES", "RELATED", "PRECEDES", "FOLLOWS"]), isRequired: z.boolean(), notes: z.string().trim().max(500) })).max(20).refine((items) => new Set(items.map((item) => `${item.targetPromptId}:${item.type}`)).size === items.length);
const promptSchema = z.object({
  key: z.string().trim().toUpperCase().regex(/^VOG-PROMPT-[A-Z0-9-]{3,80}$/), title: z.string().trim().min(5).max(180), purpose: z.string().trim().max(2000).optional(), categoryId: z.string().uuid(), ownerLabel: z.string().trim().min(2).max(160), summary: z.string().trim().min(10).max(4000), audience: z.string().trim().max(500).optional(), classification: z.string().trim().max(200).optional(), expectedOutput: z.string().trim().max(10000).optional(), requiredInputsText: z.string().trim().max(10000).optional(), promptBody: z.string().trim().min(50), changeNotes: z.string().trim().min(10).max(5000), nextReviewAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), intent: z.enum(["draft", "review"]), reviewer: z.string().trim().toLowerCase().email().optional(), reviewMessage: z.string().trim().max(2000).optional(),
});

function stringValue(formData: FormData, key: string) { const value=formData.get(key); return typeof value === "string" ? value : ""; }
function ids(formData: FormData, key: string) { return [...new Set(formData.getAll(key).filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)))]; }
function jsonValue<T>(formData: FormData, key: string, schema: z.ZodType<T>) { try { return schema.safeParse(JSON.parse(stringValue(formData, key) || "[]")); } catch { return schema.safeParse(null); } }

export async function createPrompt(formData: FormData) {
  const user = await requireSession(["admin", "editor"]);
  if (!canEditPrompt(user.roles)) redirect("/library");
  const intent = stringValue(formData, "intent") === "review" ? "review" : "draft";
  const parsed = promptSchema.safeParse({ key: stringValue(formData,"key"), title: stringValue(formData,"title"), purpose: stringValue(formData,"purpose") || undefined, categoryId: stringValue(formData,"categoryId"), ownerLabel: stringValue(formData,"ownerLabel"), summary: stringValue(formData,"summary"), audience: stringValue(formData,"audience") || undefined, classification: stringValue(formData,"classification") || undefined, expectedOutput: stringValue(formData,"expectedOutput") || undefined, requiredInputsText: stringValue(formData,"requiredInputsText") || undefined, promptBody: stringValue(formData,"promptBody"), changeNotes: stringValue(formData,"changeNotes"), nextReviewAt: stringValue(formData,"nextReviewAt"), intent, reviewer: stringValue(formData,"reviewer") || undefined, reviewMessage: stringValue(formData,"reviewMessage") || undefined });
  const variables = jsonValue(formData, "runnerInputsJson", variableSchema);
  const relationships = jsonValue(formData, "relationshipsJson", relationSchema);
  const stageIds = ids(formData, "stageIds");
  const platformIds = ids(formData, "platformIds");
  const standardVersionIds = ids(formData, "standardVersionIds");
  const componentVersionIds = ids(formData, "componentVersionIds");
  if (!parsed.success || !variables.success || !relationships.success || stageIds.length === 0 || (intent === "review" && (!parsed.data?.reviewer || (parsed.data.reviewMessage?.length ?? 0) < 5))) redirect("/library/new?error=invalid");
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const existingPrompt = await db.prompt.findFirst({ where: { key: parsed.data.key, workspace: { key: workspaceKey } }, select: { id: true } });
  if (existingPrompt) redirect("/library/new?error=key");
  if (intent === "review") {
    const reviewer = await db.user.findUnique({ where: { email: parsed.data.reviewer! }, include: { memberships: { where: { workspace: { key: workspaceKey, isActive: true }, role: { in: ["ADMIN", "APPROVER"] } } } } });
    if (!reviewer?.isActive || (!isEnvironmentAdmin(reviewer.email) && reviewer.memberships.length === 0)) redirect("/library/new?error=reviewer");
  }
  const created = await db.$transaction(async (tx) => {
    const workspace = await tx.workspace.findFirstOrThrow({ where: { key: workspaceKey, isActive: true } });
    const actor = await tx.user.upsert({ where: { email: user.email }, update: { displayName: user.name ?? undefined, isActive: true }, create: { email: user.email, displayName: user.name, isActive: true } });
    const prompt = await tx.prompt.create({ data: { workspaceId: workspace.id, key: parsed.data.key, title: parsed.data.title, purpose: parsed.data.purpose, categoryId: parsed.data.categoryId, ownerLabel: parsed.data.ownerLabel, createdById: actor.id } });
    const version = await tx.promptVersion.create({ data: { promptId: prompt.id, canonicalVersionId: `${prompt.key}-V1.0`, status: intent === "review" ? "PILOT" : "DRAFT", summary: parsed.data.summary, audience: parsed.data.audience, classification: parsed.data.classification, expectedOutput: parsed.data.expectedOutput, requiredInputsText: parsed.data.requiredInputsText, promptBody: parsed.data.promptBody, changeNotes: parsed.data.changeNotes, nextReviewAt: new Date(`${parsed.data.nextReviewAt}T00:00:00.000Z`), createdById: actor.id, approverLabel: intent === "review" ? parsed.data.reviewer : null } });
    if (variables.data.length) await tx.promptInput.createMany({ data: variables.data.map((item,index) => ({ promptVersionId: version.id, key:item.key,label:item.label,inputType:item.inputType,description:item.description || null,isRequired:item.isRequired,sequence:index+1 })) });
    await tx.promptVersionFlightPathStage.createMany({ data: stageIds.map((stageId,index) => ({ promptVersionId: version.id, stageId, isPrimary:index===0 })) });
    if (platformIds.length) await tx.promptVersionPlatform.createMany({ data: platformIds.map((platformId) => ({ promptVersionId: version.id, platformId })) });
    if (standardVersionIds.length) await tx.promptVersionStandard.createMany({ data: standardVersionIds.map((standardVersionId) => ({ promptVersionId: version.id, standardVersionId, isMandatory:true })) });
    if (componentVersionIds.length) await tx.promptVersionComponent.createMany({ data: componentVersionIds.map((componentVersionId,index) => ({ promptVersionId: version.id, componentVersionId, sequence:index+1, isRequired:true })) });
    if (relationships.data.length) await tx.promptRelationship.createMany({ data: relationships.data.map((item) => ({ sourcePromptId: prompt.id, targetPromptId:item.targetPromptId,type:item.type,isRequired:item.isRequired,notes:item.notes || null })) });
    await tx.auditEvent.create({ data: { workspaceId: workspace.id, actorEmail:user.email,entityType:"PromptVersion",entityId:version.id,action:"VersionCreated",reason:parsed.data.changeNotes,source:"PROMPT_OS",newState:{version:"1.0.0",status:intent === "review" ? "PILOT" : "DRAFT",newPrompt:true} } });
    if (intent === "review") await tx.auditEvent.create({ data: { workspaceId:workspace.id,actorEmail:user.email,entityType:"PromptVersion",entityId:version.id,action:"SubmittedForApproval",reason:parsed.data.reviewMessage,source:"PROMPT_OS",previousState:{status:"DRAFT"},newState:{status:"PILOT",reviewer:parsed.data.reviewer,submittedBy:user.email} } });
    return version;
  }, { isolationLevel:"Serializable" });
  revalidatePath("/"); revalidatePath("/library"); revalidatePath("/reviews");
  redirect(`/reviews?created=${created.id}${intent === "review" ? "&submitted=1" : ""}`);
}

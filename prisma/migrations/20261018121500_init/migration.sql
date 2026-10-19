-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PromptVersionStatus" AS ENUM ('DRAFT', 'PILOT', 'APPROVED', 'SUPERSEDED', 'DEPRECATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('ADMIN', 'APPROVER', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandKey" TEXT NOT NULL,
    "domain" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "googleSubject" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMembership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "categoryId" TEXT,
    "ownerLabel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "major" INTEGER NOT NULL DEFAULT 1,
    "minor" INTEGER NOT NULL DEFAULT 0,
    "patch" INTEGER NOT NULL DEFAULT 0,
    "canonicalVersionId" TEXT NOT NULL,
    "status" "PromptVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" TEXT,
    "summary" TEXT NOT NULL,
    "expectedOutput" TEXT,
    "requiredInputsText" TEXT,
    "promptBody" TEXT NOT NULL,
    "changeNotes" TEXT,
    "previousVersionId" TEXT,
    "approverLabel" TEXT,
    "confidentiality" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersionTag" (
    "promptVersionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "PromptVersionTag_pkey" PRIMARY KEY ("promptVersionId","tagId")
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersionPlatform" (
    "promptVersionId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,

    CONSTRAINT "PromptVersionPlatform_pkey" PRIMARY KEY ("promptVersionId","platformId")
);

-- CreateTable
CREATE TABLE "UsageScope" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "UsageScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersionUsage" (
    "promptVersionId" TEXT NOT NULL,
    "usageScopeId" TEXT NOT NULL,

    CONSTRAINT "PromptVersionUsage_pkey" PRIMARY KEY ("promptVersionId","usageScopeId")
);

-- CreateTable
CREATE TABLE "FlightPathStage" (
    "id" TEXT NOT NULL,
    "stageNumber" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,

    CONSTRAINT "FlightPathStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersionFlightPathStage" (
    "promptVersionId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PromptVersionFlightPathStage_pkey" PRIMARY KEY ("promptVersionId","stageId")
);

-- CreateTable
CREATE TABLE "Standard" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Standard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardVersion" (
    "id" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "major" INTEGER NOT NULL DEFAULT 1,
    "minor" INTEGER NOT NULL DEFAULT 0,
    "requirement" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StandardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersionStandard" (
    "promptVersionId" TEXT NOT NULL,
    "standardVersionId" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PromptVersionStandard_pkey" PRIMARY KEY ("promptVersionId","standardVersionId")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentVersion" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "major" INTEGER NOT NULL DEFAULT 1,
    "minor" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ComponentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersionComponent" (
    "promptVersionId" TEXT NOT NULL,
    "componentVersionId" TEXT NOT NULL,
    "sequence" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PromptVersionComponent_pkey" PRIMARY KEY ("promptVersionId","componentVersionId")
);

-- CreateTable
CREATE TABLE "PromptInput" (
    "id" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sequence" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PromptInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptOutput" (
    "id" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "clientVisible" BOOLEAN NOT NULL DEFAULT false,
    "sequence" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PromptOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptRelationship" (
    "id" TEXT NOT NULL,
    "sourcePromptId" TEXT NOT NULL,
    "targetPromptId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "PromptRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorEmail" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT,
    "previousState" JSONB,
    "newState" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_key_key" ON "Workspace"("key");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

-- CreateIndex
CREATE INDEX "WorkspaceMembership_workspaceId_role_idx" ON "WorkspaceMembership"("workspaceId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMembership_workspaceId_userId_role_key" ON "WorkspaceMembership"("workspaceId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Category_key_key" ON "Category"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Prompt_workspaceId_title_idx" ON "Prompt"("workspaceId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "Prompt_workspaceId_key_key" ON "Prompt"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_canonicalVersionId_key" ON "PromptVersion"("canonicalVersionId");

-- CreateIndex
CREATE INDEX "PromptVersion_promptId_status_idx" ON "PromptVersion"("promptId", "status");

-- CreateIndex
CREATE INDEX "PromptVersion_status_nextReviewAt_idx" ON "PromptVersion"("status", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_promptId_major_minor_patch_key" ON "PromptVersion"("promptId", "major", "minor", "patch");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_key_key" ON "Tag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_key_key" ON "Platform"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UsageScope_key_key" ON "UsageScope"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FlightPathStage_stageNumber_key" ON "FlightPathStage"("stageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FlightPathStage_key_key" ON "FlightPathStage"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Standard_key_key" ON "Standard"("key");

-- CreateIndex
CREATE UNIQUE INDEX "StandardVersion_standardId_major_minor_key" ON "StandardVersion"("standardId", "major", "minor");

-- CreateIndex
CREATE UNIQUE INDEX "Component_key_key" ON "Component"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentVersion_componentId_major_minor_key" ON "ComponentVersion"("componentId", "major", "minor");

-- CreateIndex
CREATE UNIQUE INDEX "PromptInput_promptVersionId_key_key" ON "PromptInput"("promptVersionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PromptOutput_promptVersionId_key_key" ON "PromptOutput"("promptVersionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PromptRelationship_sourcePromptId_targetPromptId_type_key" ON "PromptRelationship"("sourcePromptId", "targetPromptId", "type");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_occurredAt_idx" ON "AuditEvent"("entityType", "entityId", "occurredAt");

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersionTag" ADD CONSTRAINT "PromptVersionTag_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersionTag" ADD CONSTRAINT "PromptVersionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersionPlatform" ADD CONSTRAINT "PromptVersionPlatform_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersionPlatform" ADD CONSTRAINT "PromptVersionPlatform_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersionUsage" ADD CONSTRAINT "PromptVersionUsage_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersionUsage" ADD CONSTRAINT "PromptVersionUsage_usageScopeId_fkey" FOREIGN KEY ("usageScopeId") REFERENCES "UsageScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersionFlightPathStage" ADD CONSTRAINT "PromptVersionFlightPathStage_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersionFlightPathStage" ADD CONSTRAINT "PromptVersionFlightPathStage_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "FlightPathStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardVersion" ADD CONSTRAINT "StandardVersion_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersionStandard" ADD CONSTRAINT "PromptVersionStandard_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersionStandard" ADD CONSTRAINT "PromptVersionStandard_standardVersionId_fkey" FOREIGN KEY ("standardVersionId") REFERENCES "StandardVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentVersion" ADD CONSTRAINT "ComponentVersion_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersionComponent" ADD CONSTRAINT "PromptVersionComponent_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersionComponent" ADD CONSTRAINT "PromptVersionComponent_componentVersionId_fkey" FOREIGN KEY ("componentVersionId") REFERENCES "ComponentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptInput" ADD CONSTRAINT "PromptInput_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptOutput" ADD CONSTRAINT "PromptOutput_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptRelationship" ADD CONSTRAINT "PromptRelationship_sourcePromptId_fkey" FOREIGN KEY ("sourcePromptId") REFERENCES "Prompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptRelationship" ADD CONSTRAINT "PromptRelationship_targetPromptId_fkey" FOREIGN KEY ("targetPromptId") REFERENCES "Prompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



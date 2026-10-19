import type { Prisma, PrismaClient, PromptVersionStatus } from "@prisma/client";

type RelationDb = PrismaClient | Prisma.TransactionClient;

const CURRENT_STATUSES: PromptVersionStatus[] = ["APPROVED", "DRAFT", "PILOT"];
const UNIVERSAL_STANDARDS = new Set([
  "EVIDENCE_CLASSIFICATION",
  "ORDERED_ANALYSIS",
  "AI_ACCOUNTABILITY",
  "NO_HALLUCINATION",
  "DEFINITION_OF_DONE",
  "FINAL_QUALITY_TEST",
  "VERSION_GOVERNANCE",
]);

type GovernedVersion = {
  canonicalVersionId: string;
  classification: string | null;
  audience: string | null;
  summary: string;
  expectedOutput: string | null;
  requiredInputsText: string | null;
  prompt: { title: string; category: { key: string } | null };
  tags: { tag: { label: string } }[];
  usages: { usageScope: { name: string } }[];
};

function contains(haystack: string, terms: string[]) {
  const normalized = haystack.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

export function standardApplies(standardKey: string, version: GovernedVersion) {
  if (UNIVERSAL_STANDARDS.has(standardKey)) return true;

  const category = version.prompt.category?.key ?? "";
  const classification = version.classification?.toUpperCase() ?? "";
  const usage = version.usages.map((item) => item.usageScope.name).join(" ");
  const searchable = [
    version.prompt.title,
    version.summary,
    version.audience,
    version.expectedOutput,
    version.requiredInputsText,
    ...version.tags.map((item) => item.tag.label),
  ].filter(Boolean).join(" ");

  switch (standardKey) {
    case "BUSINESS_OUTCOMES_FIRST":
      return !["OPERATIONS_TALENT", "EXECUTIVE_COMMUNICATION"].includes(category);
    case "FLIGHTPATH_ALIGNMENT":
      return ["PMO_GOVERNANCE", "FLIGHTPATH_DELIVERY", "FUNCTIONAL_DELIVERY", "ARCHITECTURE_TECHNICAL", "COMMERCIAL_ESTIMATION", "PARTNER_GOVERNANCE", "ATLAS_AI_ENABLEMENT"].includes(category)
        || contains(searchable, ["flightpath"]);
    case "TRACEABILITY":
      return ["PMO_GOVERNANCE", "FLIGHTPATH_DELIVERY", "FUNCTIONAL_DELIVERY", "ARCHITECTURE_TECHNICAL", "ATLAS_AI_ENABLEMENT"].includes(category)
        || contains(classification, ["DELIVERY", "FUNCTIONAL", "TECHNICAL", "PRODUCT"]);
    case "FIT_TO_STANDARD":
      return contains(searchable, ["salesforce"]);
    case "SYSTEM_OF_RECORD":
      return ["PMO_GOVERNANCE", "FLIGHTPATH_DELIVERY", "FUNCTIONAL_DELIVERY", "ARCHITECTURE_TECHNICAL", "ATLAS_AI_ENABLEMENT"].includes(category)
        || contains(classification, ["DELIVERY", "FUNCTIONAL", "TECHNICAL", "PRODUCT"]);
    case "ATLAS_BOUNDARY":
      return ["PMO_GOVERNANCE", "FLIGHTPATH_DELIVERY", "FUNCTIONAL_DELIVERY", "PARTNER_GOVERNANCE", "ATLAS_AI_ENABLEMENT"].includes(category)
        || contains(classification, ["DELIVERY", "FUNCTIONAL", "PRODUCT"]);
    case "CURRENT_EXTERNAL_EVIDENCE":
      return category === "ADVISORY_RESEARCH" || contains(searchable, ["research", "regulation", "regulatory", "official salesforce", "license", "licensing", "industry intelligence", "product documentation"]);
    case "INTERNAL_VS_EXTERNAL":
      return contains(usage, ["client-facing", "partner-facing"]);
    default:
      return false;
  }
}

export async function governanceIntegrity(db: RelationDb, workspaceKey: string) {
  const importedVersions = await db.promptVersion.findMany({
    where: { createdById: null, status: { in: CURRENT_STATUSES }, prompt: { workspace: { key: workspaceKey } } },
    include: {
      prompt: { include: { category: true } },
      tags: { include: { tag: true } },
      usages: { include: { usageScope: true } },
      standards: { include: { standardVersion: { include: { standard: true } } } },
      components: { include: { componentVersion: { include: { component: true } } } },
    },
  });
  const activeStandards = await db.standardVersion.findMany({ where: { isActive: true }, include: { standard: true } });
  const activeComponents = await db.componentVersion.findMany({ where: { isActive: true }, include: { component: true } });
  const componentByKey = new Map(activeComponents.map((version) => [version.component.key, version]));

  let expectedStandards = 0;
  let actualStandards = 0;
  let expectedComponents = 0;
  let actualComponents = 0;
  let mismatchedVersions = 0;

  for (const version of importedVersions) {
    const desiredStandards = activeStandards.filter((item) => standardApplies(item.standard.key, version)).map((item) => item.id).sort();
    const currentStandards = version.standards.map((item) => item.standardVersionId).sort();
    const componentKey = `${version.canonicalVersionId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_REQUIRED_ANALYSIS_SEQUENCE`;
    const desiredComponent = componentByKey.get(componentKey);
    const currentComponents = version.components.map((item) => item.componentVersionId).sort();
    const desiredComponents = desiredComponent ? [desiredComponent.id] : [];

    expectedStandards += desiredStandards.length;
    actualStandards += currentStandards.length;
    expectedComponents += desiredComponents.length;
    actualComponents += currentComponents.length;
    if (desiredStandards.join("|") !== currentStandards.join("|") || desiredComponents.join("|") !== currentComponents.join("|")) mismatchedVersions += 1;
  }

  return { importedVersions, activeStandards, activeComponents, expectedStandards, actualStandards, expectedComponents, actualComponents, mismatchedVersions };
}

export async function reconcileGovernanceRelations(db: RelationDb, workspaceKey: string) {
  const integrity = await governanceIntegrity(db, workspaceKey);
  const standardLinks: { promptVersionId: string; standardVersionId: string; isMandatory: boolean }[] = [];
  const componentLinks: { promptVersionId: string; componentVersionId: string; sequence: number; isRequired: boolean }[] = [];
  const componentByKey = new Map(integrity.activeComponents.map((version) => [version.component.key, version]));

  for (const version of integrity.importedVersions) {
    for (const standard of integrity.activeStandards) {
      if (standardApplies(standard.standard.key, version)) {
        standardLinks.push({ promptVersionId: version.id, standardVersionId: standard.id, isMandatory: true });
      }
    }
    const componentKey = `${version.canonicalVersionId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_REQUIRED_ANALYSIS_SEQUENCE`;
    const component = componentByKey.get(componentKey);
    if (component) componentLinks.push({ promptVersionId: version.id, componentVersionId: component.id, sequence: 1, isRequired: true });
  }

  const versionIds = integrity.importedVersions.map((version) => version.id);
  if (versionIds.length) {
    await db.promptVersionStandard.deleteMany({ where: { promptVersionId: { in: versionIds } } });
    await db.promptVersionComponent.deleteMany({ where: { promptVersionId: { in: versionIds } } });
  }
  if (standardLinks.length) await db.promptVersionStandard.createMany({ data: standardLinks });
  if (componentLinks.length) await db.promptVersionComponent.createMany({ data: componentLinks });

  return {
    versions: versionIds.length,
    standardLinks: standardLinks.length,
    componentLinks: componentLinks.length,
    correctedVersions: integrity.mismatchedVersions,
  };
}

import Link from "next/link";
import type { Prisma, PromptVersionStatus } from "@prisma/client";
import { PromptCard } from "@/components/prompt-card";
import { canEditPrompt } from "@/lib/auth/policy";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatReviewDate } from "@/lib/prompt-summary";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const statusOptions: Array<{ value: PromptVersionStatus; label: string }> = [
  { value: "APPROVED", label: "Approved" },
  { value: "DRAFT", label: "Draft" },
  { value: "PILOT", label: "In review" },
  { value: "SUPERSEDED", label: "Superseded" },
  { value: "DEPRECATED", label: "Deprecated" },
  { value: "ARCHIVED", label: "Archived" },
];

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

const statusLabel = (status: PromptVersionStatus) =>
  statusOptions.find((option) => option.value === status)?.label ?? status;

export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireSession();
  const params = await searchParams;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const query = first(params.q).slice(0, 160);
  const category = first(params.category);
  const stage = first(params.stage);
  const platform = first(params.platform);
  const owner = first(params.owner);
  const canBrowseGovernanceStates = canEditPrompt(user.roles) || user.roles.includes("approver");
  const requestedStatus = first(params.status).toUpperCase() as PromptVersionStatus;
  const selectedStatus = canBrowseGovernanceStates && statusOptions.some(({ value }) => value === requestedStatus)
    ? requestedStatus
    : "APPROVED";

  const versionFilter: Prisma.PromptVersionWhereInput = {
    status: selectedStatus,
    ...(stage ? { stages: { some: { stage: { key: stage } } } } : {}),
    ...(platform ? { platforms: { some: { platform: { key: platform } } } } : {}),
  };

  const textFilter: Prisma.PromptWhereInput | undefined = query
    ? {
        OR: [
          { key: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { purpose: { contains: query, mode: "insensitive" } },
          { ownerLabel: { contains: query, mode: "insensitive" } },
          { category: { name: { contains: query, mode: "insensitive" } } },
          {
            versions: {
              some: {
                ...versionFilter,
                OR: [
                  { summary: { contains: query, mode: "insensitive" } },
                  { audience: { contains: query, mode: "insensitive" } },
                  { expectedOutput: { contains: query, mode: "insensitive" } },
                  { requiredInputsText: { contains: query, mode: "insensitive" } },
                  { promptBody: { contains: query, mode: "insensitive" } },
                  { tags: { some: { tag: { label: { contains: query, mode: "insensitive" } } } } },
                ],
              },
            },
          },
        ],
      }
    : undefined;

  const [prompts, categories, stages, platforms, owners] = await Promise.all([
    db.prompt.findMany({
      where: {
        isActive: true,
        workspace: { key: workspaceKey, isActive: true },
        ...(category ? { category: { key: category } } : {}),
        ...(owner ? { ownerLabel: owner } : {}),
        versions: { some: versionFilter },
        ...(textFilter ?? {}),
      },
      orderBy: { title: "asc" },
      include: {
        category: true,
        versions: {
          where: versionFilter,
          orderBy: [{ major: "desc" }, { minor: "desc" }, { patch: "desc" }],
          take: 1,
          include: {
            stages: { include: { stage: true }, orderBy: { stage: { stageNumber: "asc" } } },
            platforms: { include: { platform: true } },
          },
        },
      },
    }),
    db.category.findMany({
      where: { isActive: true, prompts: { some: { workspace: { key: workspaceKey }, versions: { some: { status: selectedStatus } } } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.flightPathStage.findMany({
      where: { versions: { some: { promptVersion: { status: selectedStatus, prompt: { workspace: { key: workspaceKey } } } } } },
      orderBy: { stageNumber: "asc" },
    }),
    db.platform.findMany({
      where: { versions: { some: { promptVersion: { status: selectedStatus, prompt: { workspace: { key: workspaceKey } } } } } },
      orderBy: { name: "asc" },
    }),
    db.prompt.findMany({
      where: { isActive: true, workspace: { key: workspaceKey }, versions: { some: { status: selectedStatus } } },
      distinct: ["ownerLabel"],
      orderBy: { ownerLabel: "asc" },
      select: { ownerLabel: true },
    }),
  ]);

  const summaries = prompts.map((prompt) => {
    const version = prompt.versions[0];
    return {
      key: prompt.key,
      title: prompt.title,
      category: prompt.category?.name ?? "Uncategorized",
      version: `${version.major}.${version.minor}${version.patch ? `.${version.patch}` : ""}`,
      status: statusLabel(version.status),
      statusKey: version.status.toLowerCase(),
      stage: version.stages.map(({ stage: item }) => item.nameEn).join(" / ") || "Cross-stage",
      summary: version.summary,
      owner: prompt.ownerLabel,
      review: formatReviewDate(version.nextReviewAt),
      platforms: version.platforms.map(({ platform: item }) => item.name).join(", ") || "Platform agnostic",
    };
  });

  const activeFilterCount = [query, category, stage, platform, owner, selectedStatus !== "APPROVED" ? selectedStatus : ""].filter(Boolean).length;

  return <>
    <section className="page-heading page-heading--actions">
      <div>
        <span className="eyebrow">LIBRARY</span>
        <h1>Approved knowledge, not just prompt text.</h1>
        <p>Search prompt content and narrow results by category, FlightPath stage, lifecycle status, platform or owner.</p>
      </div>
      {canEditPrompt(user.roles) && <Link className="button" href="/library/new">Create prompt</Link>}
    </section>
    <form className="filter-panel" method="get">
      <label className="filter-search">
        <span>Search</span>
        <input name="q" defaultValue={query} placeholder="Intent, title, content, input, output or tag…" />
      </label>
      <label>
        <span>Category</span>
        <select name="category" defaultValue={category}>
          <option value="">All categories</option>
          {categories.map((item) => <option key={item.id} value={item.key}>{item.name}</option>)}
        </select>
      </label>
      <label>
        <span>FlightPath</span>
        <select name="stage" defaultValue={stage}>
          <option value="">All stages</option>
          {stages.map((item) => <option key={item.id} value={item.key}>{item.stageNumber}. {item.nameEn}</option>)}
        </select>
      </label>
      {canBrowseGovernanceStates && <label>
        <span>Status</span>
        <select name="status" defaultValue={selectedStatus}>
          {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>}
      <label>
        <span>Platform</span>
        <select name="platform" defaultValue={platform}>
          <option value="">All platforms</option>
          {platforms.map((item) => <option key={item.id} value={item.key}>{item.name}</option>)}
        </select>
      </label>
      <label>
        <span>Owner</span>
        <select name="owner" defaultValue={owner}>
          <option value="">All owners</option>
          {owners.map((item) => <option key={item.ownerLabel} value={item.ownerLabel}>{item.ownerLabel}</option>)}
        </select>
      </label>
      <div className="filter-actions">
        <button className="button" type="submit">Apply filters</button>
        {activeFilterCount > 0 && <Link className="button button--ghost" href="/library">Clear</Link>}
      </div>
    </form>
    <div className="results-summary" aria-live="polite">
      <strong>{summaries.length}</strong> {summaries.length === 1 ? "prompt" : "prompts"}
      {activeFilterCount > 0 && <span> · {activeFilterCount} active {activeFilterCount === 1 ? "filter" : "filters"}</span>}
    </div>
    {summaries.length > 0
      ? <section className="cards">{summaries.map((prompt) => <PromptCard key={`${prompt.key}-${prompt.version}`} prompt={prompt} />)}</section>
      : <section className="panel no-results"><span className="eyebrow">NO MATCHES</span><h2>Try a broader search.</h2><p>Remove one or more filters, or search for a business outcome, deliverable, owner or phrase contained in the prompt.</p><Link className="button button--ghost" href="/library">Clear all filters</Link></section>}
  </>;
}

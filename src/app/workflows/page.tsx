import Link from "next/link";
import { syncGovernanceMap } from "@/app/actions/governance-relations";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { governanceIntegrity } from "@/lib/governance-relations";

const stageGuidance: Record<string, { purpose: string; gate: string }> = {
  IGNITE_ALIGN: { purpose: "Frame the opportunity, strategic outcomes and initial value hypothesis.", gate: "Aligned opportunity and sponsor intent" },
  SYNC_MOBILIZE: { purpose: "Mobilize the team, governance, outcomes and delivery baseline.", gate: "Accountable team and governed baseline" },
  VALIDATE_SHAPE: { purpose: "Validate evidence, shape the future state and make scope decisions.", gate: "Validated scope and solution direction" },
  CREATE_ADAPT: { purpose: "Build, configure and adapt the solution against approved outcomes.", gate: "Build complete and ready to prove" },
  PROVE_CONFIRM: { purpose: "Prove quality, acceptance, readiness and measurable value.", gate: "Accepted release and launch decision" },
  DEPLOY_LAUNCH: { purpose: "Deploy safely, launch operations and stabilize the release.", gate: "Production launch and controlled transition" },
  AMPLIFY_EVOLVE: { purpose: "Drive adoption, measure value and evolve the capability.", gate: "Value evidence and prioritized evolution" },
};

const governanceSteps = [
  ["01", "Draft", "Create an immutable candidate version from the latest approved prompt."],
  ["02", "Review", "Compare content, inputs, outputs and change rationale side by side."],
  ["03", "Approve", "An authorized approver publishes the governed version and supersedes its predecessor."],
  ["04", "Reuse", "Viewers access and copy only the latest approved knowledge."],
];

export default async function WorkflowsPage({ searchParams }: { searchParams: Promise<{ sync?: string; corrected?: string }> }) {
  const user = await requireSession();
  const query = await searchParams;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const [stages, approvedCount, unmappedCount, integrity] = await Promise.all([
    db.flightPathStage.findMany({
      orderBy: { stageNumber: "asc" },
      include: {
        versions: {
          where: { promptVersion: { status: "APPROVED", prompt: { isActive: true, workspace: { key: workspaceKey, isActive: true } } } },
          include: {
            promptVersion: {
              include: {
                prompt: { include: { category: true } },
                standards: { include: { standardVersion: { include: { standard: true } } } },
                components: { include: { componentVersion: { include: { component: true } } } },
              },
            },
          },
        },
      },
    }),
    db.promptVersion.count({ where: { status: "APPROVED", prompt: { isActive: true, workspace: { key: workspaceKey, isActive: true } } } }),
    db.promptVersion.count({ where: { status: "APPROVED", stages: { none: {} }, prompt: { isActive: true, workspace: { key: workspaceKey, isActive: true } } } }),
    governanceIntegrity(db, workspaceKey),
  ]);

  const mappedPromptIds = new Set(stages.flatMap((stage) => stage.versions.map((link) => link.promptVersion.promptId)));
  const isAdmin = user.roles.includes("admin");
  const integrityCurrent = integrity.mismatchedVersions === 0;

  return <>
    <section className="page-heading page-heading--actions">
      <div><span className="eyebrow">FLIGHTPATH WORKFLOWS</span><h1>Governed work, from intent to measurable value.</h1><p className="section-intro">Each stage now uses the approved prompts, Standards and Components held in the library. Open any prompt directly from the stage where the work happens.</p></div>
      <Link className="button button--ghost" href="/library">Open library</Link>
    </section>

    {query.sync === "complete" && <div className="notice notice--success">Governance map synchronized. {query.corrected ?? "0"} prompt versions were corrected.</div>}

    <section className="metrics workflow-metrics">
      <div className="metric"><span>FlightPath stages</span><strong>{stages.length}</strong><small>End-to-end operating model</small></div>
      <div className="metric"><span>Approved prompts</span><strong>{approvedCount}</strong><small>{mappedPromptIds.size} mapped to workflow</small></div>
      <div className="metric"><span>Unmapped</span><strong>{unmappedCount}</strong><small>{unmappedCount === 0 ? "Full stage coverage" : "Needs governance review"}</small></div>
      <div className="metric"><span>Relationship integrity</span><strong>{integrityCurrent ? "Current" : integrity.mismatchedVersions}</strong><small>{integrityCurrent ? "Standards and Components aligned" : "Versions need synchronization"}</small></div>
    </section>

    <section className="flightpath-map" aria-label="FlightPath stages">
      {stages.map((stage) => {
        const guide = stageGuidance[stage.key] ?? { purpose: "Governed FlightPath stage.", gate: "Evidence-based gate decision" };
        const promptLinks = Array.from(new Map(stage.versions.map((link) => [link.promptVersion.promptId, link])).values())
          .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.promptVersion.prompt.title.localeCompare(b.promptVersion.prompt.title));
        const standardNames = new Set(stage.versions.flatMap((link) => link.promptVersion.standards.map((item) => item.standardVersion.standard.name)));
        const componentNames = new Set(stage.versions.flatMap((link) => link.promptVersion.components.map((item) => item.componentVersion.component.name)));
        const primaryCount = promptLinks.filter((link) => link.isPrimary).length;
        return <article className="panel flightpath-stage" id={`stage-${stage.stageNumber}`} key={stage.id}>
          <div className="stage-marker"><span>{stage.stageNumber}</span></div>
          <div className="stage-body">
            <div className="stage-heading"><div><span className="eyebrow">STAGE {stage.stageNumber}</span><h2>{stage.nameEn}</h2><small>{stage.nameEs}</small></div><div className="stage-count"><strong>{promptLinks.length}</strong><span>approved prompts</span></div></div>
            <p>{guide.purpose}</p>
            <div className="gate-line"><span>Gate outcome</span><strong>{guide.gate}</strong></div>
            <div className="stage-facts"><span>{primaryCount} primary</span><span>{standardNames.size} Standards</span><span>{componentNames.size} Components</span></div>
            <div className="stage-prompt-list">
              {promptLinks.slice(0, 6).map((link) => <Link href={`/library/${link.promptVersion.prompt.key}`} key={link.promptVersion.id}><span>{link.promptVersion.prompt.category?.name ?? "Prompt"}</span><strong>{link.promptVersion.prompt.title}</strong>{link.isPrimary && <small>Primary</small>}</Link>)}
            </div>
            {promptLinks.length > 6 && <details className="stage-more"><summary>Show {promptLinks.length - 6} more prompts</summary><div className="stage-prompt-list">{promptLinks.slice(6).map((link) => <Link href={`/library/${link.promptVersion.prompt.key}`} key={link.promptVersion.id}><span>{link.promptVersion.prompt.category?.name ?? "Prompt"}</span><strong>{link.promptVersion.prompt.title}</strong>{link.isPrimary && <small>Primary</small>}</Link>)}</div></details>}
          </div>
        </article>;
      })}
    </section>

    <section className="workflow-governance">
      <div className="panel-heading"><div><span className="eyebrow">VERSION GOVERNANCE</span><h2>From controlled draft to approved reuse</h2></div><Link href="/reviews">Open review queue</Link></div>
      <div className="workflow-path">{governanceSteps.map(([number, title, body]) => <article className="panel workflow-step" key={number}><span className="step-number">{number}</span><h2>{title}</h2><p>{body}</p></article>)}</div>
    </section>

    <section className={`panel integrity-panel ${integrityCurrent ? "integrity-panel--current" : ""}`}>
      <div><span className="eyebrow">GOVERNANCE INTEGRITY</span><h2>{integrityCurrent ? "Relationship map is aligned" : `${integrity.mismatchedVersions} versions need relationship correction`}</h2><p>Applicability follows the Master Library: universal controls remain shared, while contextual Standards such as Fit-to-Standard, external evidence and content separation are linked only where relevant. Components remain one-to-one with their source prompt.</p></div>
      <div className="integrity-numbers"><span><strong>{integrity.expectedStandards}</strong> expected Standard links</span><span><strong>{integrity.expectedComponents}</strong> expected Component links</span></div>
      {isAdmin && !integrityCurrent && <form action={syncGovernanceMap}><button className="button" type="submit">Synchronize governance map</button></form>}
    </section>
  </>;
}

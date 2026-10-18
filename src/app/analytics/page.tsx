import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AnalyticsPage() {
  await requireSession();
  const workspace={key:process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA",isActive:true};
  const [prompts,approved,drafts,standards,components,categories]=await Promise.all([db.prompt.count({where:{workspace,isActive:true}}),db.promptVersion.count({where:{prompt:{workspace},status:"APPROVED"}}),db.promptVersion.count({where:{prompt:{workspace},status:{in:["DRAFT","PILOT"]}}}),db.standard.count(),db.component.count(),db.category.findMany({orderBy:{name:"asc"},include:{_count:{select:{prompts:true}}}})]);
  const metrics=[["Prompts",prompts],["Approved",approved],["In review",drafts],["Standards",standards],["Components",components]] as const;
  const max=Math.max(1,...categories.map((item)=>item._count.prompts));
  return <><section className="page-heading"><span className="eyebrow">ANALYTICS</span><h1>Library health at a glance.</h1><p className="section-intro">Live operational counts from the governed workspace. Usage and outcome analytics will be added as prompt execution becomes instrumented.</p></section><section className="metrics">{metrics.map(([label,value])=><div className="metric" key={label}><strong>{value}</strong><span>{label}</span></div>)}</section><section className="panel"><div className="panel-heading"><h2>Prompts by category</h2><span>{categories.length} categories</span></div><div className="analytics-bars">{categories.map((category)=><div className="analytics-row" key={category.id}><strong>{category.name}</strong><div className="analytics-track"><div className="analytics-fill" style={{width:`${(category._count.prompts/max)*100}%`}}/></div><span>{category._count.prompts}</span></div>)}</div></section></>;
}

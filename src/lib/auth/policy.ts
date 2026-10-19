export type AppRole="admin"|"approver"|"editor"|"viewer";
export const allRoles:AppRole[]=["admin","approver","editor","viewer"];
export function isEnvironmentAdmin(email:string|null|undefined){const normalized=email?.trim().toLowerCase();const admin=process.env.PROMPT_OS_ADMIN_EMAIL?.trim().toLowerCase();return Boolean(normalized&&admin&&normalized===admin)}
export function isAllowedDomain(email:string|null|undefined){const normalized=email?.trim().toLowerCase();const domain=process.env.AUTH_ALLOWED_DOMAIN?.trim().toLowerCase()??"vogaranova.com";return Boolean(normalized&&normalized.endsWith(`@${domain}`))}
export function resolveRoles(email:string|null|undefined):AppRole[]{if(isEnvironmentAdmin(email))return allRoles;if(isAllowedDomain(email))return["viewer"];return[]}
export function expandRoles(roles:AppRole[]):AppRole[]{const expanded=new Set<AppRole>(roles);if(expanded.has("admin"))allRoles.forEach(role=>expanded.add(role));if(expanded.has("approver")||expanded.has("editor"))expanded.add("viewer");return allRoles.filter(role=>expanded.has(role))}
export const canCopyPrompt=(roles:AppRole[])=>roles.includes("viewer");
export const canEditPrompt=(roles:AppRole[])=>roles.includes("editor")||roles.includes("admin");
export const canApprovePrompt=(roles:AppRole[])=>roles.includes("approver")||roles.includes("admin");

export type AppRole="admin"|"approver"|"editor"|"viewer";
export function resolveRoles(email:string|null|undefined):AppRole[]{if(!email)return[];const normalized=email.trim().toLowerCase();const admin=process.env.PROMPT_OS_ADMIN_EMAIL?.trim().toLowerCase();const domain=process.env.AUTH_ALLOWED_DOMAIN?.trim().toLowerCase()??"vogaranova.com";if(admin&&normalized===admin)return["admin","approver","editor","viewer"];if(normalized.endsWith(`@${domain}`))return["viewer"];return[]}
export const canCopyPrompt=(roles:AppRole[])=>roles.includes("viewer");
export const canEditPrompt=(roles:AppRole[])=>roles.includes("editor")||roles.includes("admin");
export const canApprovePrompt=(roles:AppRole[])=>roles.includes("approver")||roles.includes("admin");

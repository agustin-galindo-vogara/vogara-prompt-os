# Access Model

## Vogara Nova
The account in `PROMPT_OS_ADMIN_EMAIL` is the protected break-glass Admin / Approver / Editor / Viewer.

Other verified `@vogaranova.com` accounts receive Viewer access by default. Admins can provision additional workspace roles through `/settings/members`; those PostgreSQL-backed assignments are evaluated on every authenticated request and can grant Admin, Approver, Editor, or Viewer capabilities without changing Firebase tokens.

Viewers can search, open, inspect metadata/relationships, and copy complete Approved prompt content or individual sections. They cannot create, edit, approve, change taxonomy, or alter branding.

Editors can create and update Draft versions and submit them to an eligible Approver. Approvers can act only on versions assigned to them, while Admins retain an override for continuity. Member provisioning, role changes, deactivation, review assignment, and review decisions are recorded as audit events.

Access policies are workspace-scoped for future deployments to other divisions or companies.

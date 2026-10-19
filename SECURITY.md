# Security

The repository currently has public visibility. Treat all committed source as publicly visible.

Never commit production prompt bodies, Master Library exports, credentials, database passwords, client documents, opportunity artifacts, private font files, or production environment files.

Authorization policy:
- Authentication is limited to verified Google Workspace accounts at `@vogaranova.com`.
- Workspace roles are persisted in PostgreSQL and managed by active Admins: Admin, Approver, Editor and Viewer.
- The account configured through `PROMPT_OS_ADMIN_EMAIL` is the protected bootstrap administrator.
- Viewers may search, run and copy Approved prompt content. Editors may create and revise drafts. Approvers may decide assigned reviews. Admins manage access and may decide any review.
- Approved prompt versions are immutable; changes create a governed successor version.

Operational controls:
- Mutating Runner, copy and outcome endpoints require an authenticated server session and enforce per-user, database-backed request limits.
- Runner variable values and rendered prompts are never persisted. Audit events store only prompt/version identifiers and variable keys.
- The public health endpoint discloses only service/database reachability and never returns configuration or secrets.
- Production responses apply transport, framing, MIME, referrer and browser-permission security headers.
- Governance, access changes, prompt reuse and outcome feedback are written to the Audit Explorer.

Report suspected credential exposure by immediately rotating the affected secret in Google Secret Manager and triggering a clean App Hosting rollout. Do not place credentials in an issue or pull request.

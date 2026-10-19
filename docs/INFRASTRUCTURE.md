# Infrastructure

## Firebase and Google Workspace

- Firebase project: `vogara-prompt-os`
- App Hosting backend: `vogara-prompt-os`
- Primary application domain: `prompts.vogaranova.com`
- Identity provider: Google Sign-In
- Allowed identity domain: `vogaranova.com`, enforced after server-side token verification

The Google provider domain hint improves account selection but is not an authorization control. The server independently requires a verified email and resolves workspace roles from the configured domain and admin email.

## PostgreSQL

The application uses Prisma directly against Cloud SQL for PostgreSQL. The connection string is injected through the `databaseUrl` App Hosting secret as `DATABASE_URL`. Agents and clients consume governed content through application APIs and do not connect to PostgreSQL directly.

- Instance: `vogara-prompt-os-db`
- Engine: PostgreSQL 16
- Region: `us-east4`, matching App Hosting
- Network: private IP on the `default` VPC
- App Hosting egress: Direct VPC egress for private ranges only
- MVP capacity: shared-core, single-zone, 10 GB SSD with automated backups

Use private connectivity and a dedicated least-privilege database user in production. Apply migrations through `prisma migrate deploy`; never use `prisma migrate dev` against production.

## Secret names

- `databaseUrl`: Cloud SQL connection string
- `promptOsAdminEmail`: sole initial Admin / Approver / Editor identity

Firebase public web configuration values are identifiers, not privileged server credentials. Service-account private keys are for local development only; App Hosting should use Application Default Credentials.

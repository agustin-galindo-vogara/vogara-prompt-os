# Vogara Prompt OS

Governed Intelligence & Prompt Operating System for Vogara.

## MVP target
- Google Workspace authentication
- Multi-brand theming
- Prompt Library and Prompt Detail
- Versioning and approval workflow
- Latest Approved API
- PostgreSQL / Prisma
- Migration tooling for the existing Master Prompt Library

## Target deployment
- Firebase App Hosting
- Cloud SQL PostgreSQL
- prompts.vogaranova.com

## Security
Do not commit production prompt bodies, exported Master Library data, credentials, client artifacts, or private font files.

## Local setup
1. Copy `.env.example` to `.env.local` and supply development credentials.
2. Run `npm install`.
3. Run `npm run db:generate` and `npm run dev`.

Authentication is restricted server-side to verified `@vogaranova.com` accounts. The account in `PROMPT_OS_ADMIN_EMAIL` receives Admin, Approver, Editor, and Viewer roles; other allowed-domain accounts receive Viewer only.

## Deployment
Firebase App Hosting configuration lives in `firebase.json` and `apphosting.yaml`. `DATABASE_URL` and `PROMPT_OS_ADMIN_EMAIL` must be stored as App Hosting secrets, never committed. Run production migrations with `npm run db:deploy` before serving a release that changes the Prisma schema.

The backend uses Direct VPC egress to reach the private Cloud SQL address. The initial production schema is tracked under `prisma/migrations`; schema changes must be committed as immutable migrations.

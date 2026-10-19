# Architecture

Vogara Prompt OS is the governed system of record for prompts, versions, standards, reusable components, relationships, audit history, and future workflow definitions.

## Target stack
Next.js + React + TypeScript; Firebase App Hosting; Google Workspace authentication; Cloud SQL PostgreSQL; Prisma; PostgreSQL full-text search; pgvector later.

## Multi-brand
Branding is workspace configuration, never hardcoded business logic. A workspace can define product name, organization, logo assets, color tokens, typography preferences, domain, and access policy. Vogara Nova is the first workspace, not a special-case implementation.

## Boundaries
Agents consume governed content through APIs. They do not query PostgreSQL directly.

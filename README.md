# Vogara Prompt OS

Governed Intelligence & Prompt Operating System for Vogara.

This repository contains the next-generation governed prompt registry and workflow foundation for Vogara Nova. It is designed as an API-first, multi-brand system with immutable approved prompt versions, structured governance, auditability, and future agent/workflow execution.

## Current build target

MVP vertical slice:

- Google Workspace authentication
- Multi-brand theme engine
- Prompt Library
- Prompt Detail
- Prompt versioning
- Review / approval workflow
- Latest Approved API
- PostgreSQL / Prisma data model
- Migration tooling for the existing Master Prompt Library

## Security note

No production prompt bodies, credentials, exported Master Library files, or secrets are committed to this repository. Migration source files are supplied at runtime through secure local or cloud storage.

## Target deployment

- App: Firebase App Hosting
- Database: Cloud SQL for PostgreSQL
- Domain: `prompts.vogaranova.com`


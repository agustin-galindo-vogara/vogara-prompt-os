# Production runbook

## Service checks

- Primary URL: `https://prompts.vogaranova.com`
- Firebase fallback: `https://vogara-prompt-os--vogara-prompt-os.us-east4.hosted.app`
- Readiness: `GET /api/health` must return HTTP 200 with `status: ok` and `database: reachable`.
- Sign in with a verified `@vogaranova.com` account and confirm Dashboard, Library and Review Queue load.
- Run `npm run check` before merging or deploying. This executes the automated tests and a production build.

## Release and rollback

GitHub is the deployment source for Firebase App Hosting. Merge only a revision that passes `npm run check`, then watch the App Hosting rollout until it is marked current. Verify `/api/health`, sign-in, Library and Review Queue after each release.

If a release degrades the service, select the last known-good App Hosting rollout and promote/roll it back in Firebase Console. Recheck health before reopening use. Do not alter the database schema manually during rollback.

## Database

Production uses Cloud SQL for PostgreSQL 16. Apply committed migrations with `prisma migrate deploy`; never run `prisma migrate dev` against production.

Before a schema deployment:

1. Confirm automated backups are enabled.
2. Confirm point-in-time recovery is enabled and note the retained log window.
3. Create an on-demand backup for a high-risk migration.
4. Record the backup identifier in the release notes.

Quarterly, restore the newest backup into a temporary isolated instance, run basic row-count and sign-in/read checks, record the result, then remove the temporary instance. A backup is not considered verified until a restore test succeeds.

## Custom domain and authentication

The production mapping is `prompts.vogaranova.com`. Firebase App Hosting must show the custom domain as connected and its certificate as active. DNS must retain the exact records issued by Firebase.

Firebase Authentication must list both `prompts.vogaranova.com` and the Firebase `hosted.app` fallback as authorized domains. The server remains the authorization boundary and accepts only verified `@vogaranova.com` identities.

## Incident response

1. Check `/api/health` and the latest App Hosting rollout.
2. Check Cloud Run/App Hosting logs for structured `health_check_failed` events and request errors.
3. If the database is unavailable, inspect Cloud SQL availability, connections and storage before changing application settings.
4. If only the newest rollout fails, roll back to the last known-good rollout.
5. If a credential may be exposed, revoke or rotate it in Secret Manager and redeploy.
6. Record the incident, timeline, impacted users, recovery and follow-up action in the operational log.

Never paste database URLs, session cookies, OAuth codes, service-account keys or client prompt content into logs, tickets or chat.

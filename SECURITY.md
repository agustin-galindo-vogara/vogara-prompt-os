# Security

The repository currently has public visibility. Treat all committed source as publicly visible.

Never commit production prompt bodies, Master Library exports, credentials, database passwords, client documents, opportunity artifacts, private font files, or production environment files.

Initial authorization policy:
- Admin / Approver / Editor: the one account configured through PROMPT_OS_ADMIN_EMAIL.
- Viewer: authenticated users at @vogaranova.com.
- Viewers may copy Approved prompt content.
- Approved prompt versions are immutable.

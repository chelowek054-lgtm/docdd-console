# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately instead:

- through GitHub's **"Report a vulnerability"** button on the repository's Security tab, or
- by email to **chelowekapi@gmail.com** with the subject `DocDD security`.

Include what you found, how to reproduce it, and the impact you expect. You'll get an
acknowledgement within 7 days and a plan for a fix after the report is confirmed. Credit in the
release notes is offered unless you prefer to stay anonymous.

## Supported versions

DocDD Console is early-stage software. Security fixes go to the latest commit on `main`; there are
no maintained release branches yet.

## What we consider in scope

The console runs locally and listens on `127.0.0.1` by default. Of particular interest:

- reading or writing files outside the declared project root (path traversal, symlinks, `..`);
- bypassing the approval gate or the limits on role agents (an agent approving documents,
  accepting its own work or merging);
- leaking model API keys stored in the console's settings;
- authentication or authorisation flaws in the shared-server setup ([docs/14-deploy.md](docs/14-deploy.md)).

# Release and rollback runbook

This runbook separates local confidence from production proof. A successful command is not a successful release: the deployed Worker must report a successful deployment and its public health and authenticated paths must be verified.

## 1. Local quality gate

Run from a clean checkout with the supported Node.js version:

```bash
npm ci
npm test
npm run typecheck
npx wrangler types --check
npm run build
npm audit --omit=dev --audit-level=high
git diff --check
```

The test command includes a production-build Worker harness backed by real local Workerd, D1 migrations, KV, and private R2 bindings. Do not lower coverage thresholds to pass a release.

## 2. Production change inventory

```bash
npx wrangler d1 migrations list homebox-edge --remote
npx wrangler deployments status
npx wrangler d1 time-travel info homebox-edge --json
```

Save the Time Travel bookmark and timestamp in the release record before changing D1. Confirm that the listed migrations are exactly the reviewed files in `migrations/`. Stop if an unexpected migration, binding, or deployment is present.

For the first photo-enabled release, confirm the private bucket exists before deploy:

```bash
npx wrangler r2 bucket list
```

## 3. Apply and deploy

```bash
npx wrangler d1 migrations apply homebox-edge --remote
npx wrangler deploy
npx wrangler deployments status
```

Do not report completion until Wrangler reports a successful deployment and the following public checks pass.

## 4. Post-deploy smoke checks

1. `GET /healthz` returns HTTP 200 with the expected service and version.
2. `/app` returns HTTP 200 with CSP, `nosniff`, no-referrer, frame denial, and HSTS headers.
3. Owner login opens the existing asset list; search and HomeBox CSV export succeed without changing records.
4. Create one short-lived MCP connector, call `initialize`, revoke it, then confirm the same connector returns HTTP 401.
5. Test the Traditional Chinese and English UI at 375, 768, and 1280 CSS pixels and confirm there is no horizontal overflow.
6. Inspect Worker error logs for the smoke-test window; any unhandled exception blocks the release.
7. Upload a small JPEG/PNG, confirm the card thumbnail and protected original both render, switch the primary photo, and verify the R2 object count increased by two.

Never paste the admin credential or full MCP connector URL into issue text, logs, screenshots, or the release record.

## 5. Failure alerting

The repository CI workflow opens or updates the GitHub issue `CI failure: HomeBox Edge quality gate` when a run fails. This becomes active only after the workflow is published to GitHub.

Production still needs an external synthetic monitor for `/healthz` with email, Slack, Telegram, or another off-platform failure notification. Cloudflare dashboard observability is diagnostic evidence, not the alert channel. Do not call operations readiness complete until that monitor has fired a test alert successfully.

## 6. Rollback

For a Worker-code regression with healthy data:

```bash
npx wrangler deployments list
npx wrangler rollback <known-good-version-id> --message "rollback: failed HomeBox Edge release"
npx wrangler deployments status
```

Repeat all public smoke checks after rollback.

A D1 Time Travel restore rewinds later writes and is destructive. Use it only when the migration or data is proven faulty, after identifying the exact bookmark and obtaining explicit approval:

```bash
npx wrangler d1 time-travel restore homebox-edge --bookmark <pre-release-bookmark>
```

After a database restore, verify asset counts, a known asset read, HomeBox CSV export, MCP authorization, and Worker logs before reopening the service.

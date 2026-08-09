# Development roadmap

HomeBox Edge is a standalone, clean implementation rather than a HomeBox fork. Its releases do not depend on an upstream HomeBox pull request. Compatibility is earned through pinned interchange contracts and bidirectional tests.

## Phase 1 — usable item ledger

Implemented in the current v0.1 workspace:

- owner-authenticated mobile and desktop inventory
- create, search, view, edit, soft archive, and restore
- D1 FTS5 search across asset fields
- HomeBox v0.26.2 item CSV/TSV preview, confirmed import, idempotent import-ref upsert, and canonical export
- Remote MCP CRUD/search/import/export tools with complete strict input schemas
- individually revocable KV-backed MCP keys

Release gates still required before a public compatibility claim:

1. Run a real HomeBox v0.26.2 → HomeBox Edge → clean HomeBox v0.26.2 round trip.
2. Compare every field listed in `HOMEBOX-COMPATIBILITY.md`.
3. Configure real D1/KV IDs and `ADMIN_TOKEN` outside source control.
4. Apply remote migrations, deploy, and verify both the platform URL and any custom domain.
5. Run authenticated mobile and desktop browser QA against the deployed build.

## Phase 2 — collection ZIP and attachments

- parse and validate HomeBox schema-v1 collection ZIPs
- stage table rows and remap IDs/foreign keys before committing
- add R2 only when attachment read/write paths exist
- restore attachment blobs by source attachment UUID mapping
- enforce cumulative ZIP expansion and bounded input limits
- compensate D1 and R2 writes when a restore step fails
- export a full collection bundle that passes a real HomeBox restore test

This phase must not reuse raw HomeBox database rows as the internal domain model. Release-specific rows stay inside the compatibility adapter.

## Phase 3 — household workflows

- photo and document capture from mobile
- barcode/QR lookup with explicit confirmation before asset mutation
- maintenance and warranty reminders with failure notifications
- optional multi-owner collections and scoped invitations
- offline-friendly capture queue with visible sync state

Each capability ships behind its own data contract and failure-mode test; none is required for Phase 1 item compatibility.

## Upstream contribution policy

The standalone repo is the product path. An upstream HomeBox PR is useful only for a narrowly evidenced documentation or interoperability correction—for example, documenting the already-tested `HB.parent_import_ref` behavior. Product features and serverless architecture stay in HomeBox Edge rather than asking HomeBox to adopt a second runtime architecture.

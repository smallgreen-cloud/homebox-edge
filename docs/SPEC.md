# HomeBox Edge v0.1 specification

## Product boundary

HomeBox Edge is an unofficial, serverless household asset system. It reuses the TapCard MCP deployment shape—Cloudflare Worker, D1, KV, static mobile/web UI, owner authentication, and Remote MCP—but replaces the contact domain with household assets. R2 is reserved for the later attachment phase and is deliberately absent from the v0.1 runtime bindings.

v0.1 includes asset CRUD, keyword search, soft archive, HomeBox v0.26.2 CSV/TSV import, canonical CSV export, web/mobile access, and Remote MCP. Full HomeBox collection-ZIP restore, multi-user collections, barcode enrichment, notifications, and vector search are later phases.

## Invariants

1. Every private query includes the owner ID.
2. Import previews parse and validate without writing.
3. Import writes require explicit confirmation.
4. Non-empty `import_ref` is unique per owner and is upserted.
5. Parent references cannot point to the same asset.
6. Export output uses pinned HomeBox canonical headers and deterministic custom-field order.
7. Archive is reversible metadata; the API does not permanently delete assets.
8. Full MCP keys are returned only at creation and remain individually revocable.
9. Imported data and file content are untrusted and validated at the boundary.
10. Archived assets remain exportable and can be restored; archive never deletes a row.
11. MCP tool schemas advertise the same validated asset fields accepted by the tool handlers.

## Error contract

- `400`: malformed JSON/CSV, invalid field, invalid relationship, or oversized input.
- `401`: missing or invalid owner/MCP credential.
- `404`: asset not found within the authenticated owner scope.
- `409`: import was not confirmed or conflicts with an ambiguous import reference.
- `413`: request exceeds the documented bounded input size.
- `5xx`: storage/platform failure; response must not expose secrets or object keys.

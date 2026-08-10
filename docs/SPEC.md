# HomeBox Edge v0.2 specification

## Product boundary

HomeBox Edge is an unofficial, serverless household asset system. It reuses the TapCard MCP deployment shape—Cloudflare Worker, D1, KV, private R2, Cloudflare Images, static mobile/web UI, owner authentication, and Remote MCP—but replaces the contact domain with household assets.

v0.2 includes asset CRUD, keyword search, soft archive, private photo originals, generated thumbnails, primary-photo selection, HomeBox v0.26.2 CSV/TSV import, canonical CSV export, web/mobile access, and Remote MCP. Full HomeBox collection-ZIP restore/export, multi-user collections, barcode enrichment, notifications, and vector search are later phases.

## Invariants

1. Every private query includes the owner ID.
2. Import previews parse and validate without writing.
3. Import writes require explicit confirmation.
4. Non-empty `import_ref` is unique per owner and is upserted.
5. Parent references cannot point to the same asset and the complete parent graph remains acyclic.
6. Export output uses pinned HomeBox canonical headers and deterministic custom-field order.
7. Archive is reversible metadata; the API does not permanently delete assets.
8. Full MCP keys are returned only at creation, remain individually revocable, and are persisted only through SHA-256 fingerprint indexes; legacy raw indexes rotate on successful use.
9. Imported data and file content are untrusted, byte-bounded before parsing, and validated at the boundary.
10. Archived assets remain exportable and can be restored; archive never deletes a row.
11. MCP tool schemas advertise the same validated asset fields accepted by the tool handlers.
12. Every confirmed CSV import commits all rows in one D1 transaction or commits none.
13. HomeBox location entity rows define hierarchy and never become household assets.
14. D1 is the authoritative MCP key registry; KV is not used as a mutable owner-key index.
15. Parent existence and acyclic parent relationships are enforced in both the domain layer and D1 triggers so bypasses fail closed.
16. Public API and MCP failures expose only stable client-safe messages; infrastructure details remain in structured server logs.
17. Photo input is type-allowlisted and byte-bounded before buffering; SVG is not accepted.
18. D1 stores attachment ownership and R2 object references; private object keys never appear in public API or MCP results.
19. Every photo original has an upload-time 500px WebP thumbnail, and one asset has at most one primary photo.
20. R2 writes are compensated when D1 attachment metadata cannot commit.

## Error contract

- `400`: malformed JSON/CSV, invalid field, or invalid relationship.
- `401`: missing or invalid owner/MCP credential.
- `404`: asset not found within the authenticated owner scope.
- `409`: import was not confirmed or conflicts with an ambiguous import reference.
- `413`: request exceeds the documented bounded input size.
- `5xx`: storage/platform failure; response must not expose secrets or object keys.

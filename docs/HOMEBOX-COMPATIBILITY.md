# HomeBox compatibility contract

## Pinned source

- Upstream: `sysadminsmedia/homebox`
- Release: `v0.26.2`
- Commit: `e01dd737238a3fa7e1a6454b37de6c6fc88c86e4`
- Collected: 2026-08-08
- Precedence: pinned release tests → pinned release code → official documentation

This project is an independent implementation. It does not copy HomeBox AGPL source code. The synthetic fixtures in `tests/fixtures` reproduce the public interchange contract and contain no user data.

## Compatibility levels

| Level | Scope | v0.2 status |
|---|---|---|
| Item interchange | HomeBox CSV/TSV import and CSV export | Implemented first |
| Collection inspection | ZIP manifest and entry contract validation | Contract pinned |
| Collection restore | Full ZIP table, ID/FK and attachment restore | Planned after CSV bidirectional verification |
| Photo model | Attachment metadata, primary photo, original and thumbnail | Implemented internally; ZIP mapping pending |

“HomeBox-compatible” in v0.2 means item interchange plus compatible photo concepts. It does not yet mean byte-identical full collection backup compatibility; HomeBox CSV itself carries no attachment blobs.

## CSV/TSV item interchange

Primary sources:

- `backend/internal/core/services/reporting/io_row.go`
- `backend/internal/core/services/reporting/io_sheet.go`
- `backend/internal/core/services/reporting/import.go`
- `backend/internal/core/services/service_entities.go`
- `backend/internal/core/services/service_exports_test.go`

Rules:

- Input delimiter is comma or tab, inferred from the header row.
- Header names are case-sensitive and may appear in any order.
- `HB.location` and `HB.name` headers are required.
- Unknown columns, including unrecognized `HB.*` columns, are ignored.
- `HB.field.{name}` creates a custom field; empty values are omitted.
- Locations are separated by `/` and canonically exported as ` / `.
- Tags are separated by `;` and canonically exported as `; `.
- `HB.import_ref` is at most 100 characters and is the upsert/deduplication key.
- `HB.parent_import_ref` represents item-to-item parentage. Self-parenting is invalid.
- The complete parent-reference graph must remain acyclic, including relationships that already exist in storage.
- HomeBox exports location entities and item entities through the same CSV shape. Rows whose `HB.url` path is `/location/{id}` are location definitions and are not imported as assets; item `HB.location` carries the portable hierarchy.
- HomeBox can export `HB.url` as a relative `/item/{id}` path. Relative entity paths are instance-local navigation metadata and are omitted on import; absolute item URLs remain portable and are preserved.
- `HB.tags` is the canonical export header; `HB.labels` is accepted on import.
- `HB.purchase_date` and `HB.sold_date` are canonical exports; legacy `HB.purchase_time` and `HB.sold_time` are accepted.
- Dates export as `YYYY-MM-DD`. The pinned release accepts `YYYY-MM-DD`, `MM/DD/YYYY`, `YYYY/MM/DD`, and RFC 3339 on CSV input.
- Asset IDs accept digits with an optional hyphen and export as six digits split `000-000`.
- Export columns follow the pinned `ExportCSVRow` struct order; custom field columns are appended alphabetically.

Canonical columns:

```text
HB.import_ref
HB.parent_import_ref
HB.location
HB.tags
HB.asset_id
HB.archived
HB.url
HB.name
HB.quantity
HB.description
HB.insured
HB.notes
HB.purchase_price
HB.purchase_from
HB.purchase_date
HB.manufacturer
HB.model_number
HB.serial_number
HB.lifetime_warranty
HB.warranty_expires
HB.warranty_details
HB.sold_to
HB.sold_price
HB.sold_date
HB.sold_notes
HB.field.*
```

The upstream documentation at this release still says item-to-item relationships are unsupported. The release code and `TestCSVExportImportPreservesItemParent` prove that `HB.parent_import_ref` is supported, so the tested behavior wins.

The official `v0.26.2` exporter fixture is retained at `tests/fixtures/homebox-v0.26.2-official-export.csv`. It contains synthetic test assets plus the release's default location rows (`Synthetic for testing only`).

The agent-facing deployment fixture lives at `examples/homebox-v0.26.2-household-assets.csv`. It contains 24 common household assets (`Synthetic for testing only`) and a machine-readable expected-result manifest. Contract tests parse and canonically serialize it; the production-build harness also proves preview has no write side effect, first import creates 24 rows in an empty owner, replay updates the same 24 import refs, archived filtering works, and D1 export preserves all portable fields.

## Verified round trip

Verified on 2026-08-09 with the official Darwin arm64 `v0.26.2` binary, which reported commit `e01dd737238a3fa7e1a6454b37de6c6fc88c86e4`:

1. HomeBox Edge exported the two synthetic parent/child assets.
2. A clean HomeBox collection accepted the CSV with HTTP 204 and exported both import refs.
3. HomeBox Edge parsed that official export as two assets while excluding ten location entity rows.
4. The parent reference, locations, tags, custom fields, prices, dates, warranty fields, flags, quantities, descriptions, identifiers, and sold fields matched; `HB.url` was intentionally excluded from semantic equality because HomeBox regenerates instance-local entity paths.

The same isolated verification submitted 2,000 synthetic rows in one confirmed import, replayed them idempotently, and forced a failure at row 151 of a 250-row batch. The failed transaction left zero matching rows.

## Full collection ZIP

The pinned release uses schema version `1`. The ZIP contains:

```text
manifest.json
entity_types.json
entity_templates.json
template_fields.json
tags.json
entities.json
entity_fields.json
maintenance_entries.json
attachments.json
tag_entities.json
notifiers.json
attachments/{source-attachment-uuid}
```

`manifest.json`:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-06-14T00:00:00Z",
  "groupId": "00000000-0000-0000-0000-000000000000",
  "homeboxVersion": "optional",
  "counts": { "entities": 0 }
}
```

HomeBox imports only into a collection without user-created content. It remaps primary keys, collection/user IDs, immediate foreign keys, and deferred circular/self references in a DB transaction. Attachment blobs are restored after commit; failure triggers a compensating collection wipe. ZIP entries are limited to a cumulative 100× compressed-size expansion. A pinned upstream gap remains: UUIDs nested inside `entity_templates.default_tag_ids` are not rewritten.

Each table file is a JSON array of raw database row objects produced by `SELECT *`; its keys are therefore release-specific database column names, not a stable public DTO. The v0.26.2 importer treats a missing table JSON file as an empty table. Attachment blob names use the source attachment UUID and are mapped to the regenerated attachment row ID during restore.

## Release gate

Before claiming a new HomeBox version is supported:

1. Run this project's contract tests.
2. Import a CSV exported by that HomeBox release.
3. Export the imported assets from this project.
4. Import that CSV into a clean collection on the same HomeBox release.
5. Compare names, quantities, locations, tags, parent references, custom fields, prices, dates, warranties, sold fields, archived/insured flags, and asset IDs.
6. Record the tested release and commit in this document.

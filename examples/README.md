# HomeBox deployment validation example

`homebox-v0.26.2-household-assets.csv` is a deterministic household inventory for validating a new HomeBox Edge deployment. It follows the item CSV contract pinned to HomeBox `v0.26.2`, commit `e01dd737238a3fa7e1a6454b37de6c6fc88c86e4`.

## Data classification

**Synthetic for testing only.** Every person, vendor, manufacturer, model, serial number, price, date, warranty, URL, and sale record is fabricated test data. The file contains no real household inventory or credentials and must not be used to estimate market value or product performance.

The reserved `.example` domain is intentional. Synthetic serial numbers start with `SYN-`.

## Files

- `homebox-v0.26.2-household-assets.csv`: directly importable HomeBox item CSV.
- `homebox-v0.26.2-household-assets.expected.json`: machine-readable validation oracle.

## Covered contract

- 24 stable `HB.import_ref` values for idempotent replay.
- 23 active assets and one archived/sold asset.
- Six valid parent relationships across a desktop setup, camera bag, and toolbox.
- Chinese names, locations, tags, notes, CSV commas and escaped quotes.
- Asset IDs, quantities greater than one, insurance, purchase, warranty, lifetime-warranty, archive, and sale fields.
- Absolute item URL preservation and six `HB.field.*` custom fields.
- Empty optional fields without placeholder strings in the CSV.

## Agent validation sequence

Use a dedicated validation deployment or disposable owner. A confirmed import writes records and is not appropriate for an owner containing real inventory.

1. Read the CSV as UTF-8 without rewriting delimiters or line endings.
2. Send it to `POST /api/homebox/preview` as JSON `{ "csv_text": "..." }`.
3. Require HTTP 200, `count: 24`, and `requires_confirmation: true`. Preview must not write data.
4. Send the same content to `POST /api/homebox/import` with `confirmed: true`.
5. On an empty owner, require `{ "imported": 24, "created": 24, "updated": 0 }`.
6. Replay the same confirmed import and require `{ "imported": 24, "created": 0, "updated": 24 }`.
7. Require 23 results from `GET /api/assets` and 24 from `GET /api/assets?include_archived=true`.
8. Run the searches in the expected JSON. The archived tablet appears only when archived assets are included.
9. Export `GET /api/homebox/export`, parse it again, and compare all portable fields by `HB.import_ref`.

Any count mismatch, duplicate import ref, missing parent, cyclic graph, unexpected real-looking serial number, or changed portable field fails validation.

## Local contract test

```bash
npm run test:red -- --run tests/household-example.test.ts tests/worker-integration.test.ts
```

The test suite uses the same file from `examples/`; it does not maintain a second hidden copy.

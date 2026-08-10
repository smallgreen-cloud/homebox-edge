# Architecture

```text
Mobile / browser / AI client
             │
      Cloudflare Worker
      ├── owner API + Remote MCP
      ├── HomeBox CSV compatibility boundary
      ├── Static Assets: responsive UI
      ├── D1: assets + FTS index
      ├── D1 FTS5: keyword search
      ├── D1: strongly consistent MCP key registry + auth authority
      └── KV: legacy credential compatibility mirror
```

The HomeBox compatibility module is a pure domain boundary. It owns delimiter detection, RFC 4180 quoting, header aliases, value normalization, relationship validation, and canonical serialization. Storage receives validated immutable asset values and never parses CSV itself.

Import data flow:

```text
byte-bounded request → CSV parse → discard HomeBox location entity rows
→ schema validation → full owner graph validation → preview
→ explicit confirmation → dependency-ordered owner-scoped D1 transaction
→ D1 parent-existence/cycle triggers → result summary
```

Export data flow:

```text
owner authentication → owner-scoped D1 query → domain mapping
→ canonical deterministic CSV → streamed response
```

CSV rows live entirely in D1 and every confirmed import is submitted as one D1 batch transaction. Domain validation provides useful client errors; D1 triggers are the final invariant against direct writes and concurrent bypasses. JSON is read through bounded streams before parsing, and public errors are separated from structured infrastructure logs. Key lifecycle metadata and post-migration authorization also use D1 because KV cannot safely own a read-modify-write index. D1 and KV index connector credentials by SHA-256 fingerprint rather than the returned `hi_` secret; previously deployed raw indexes remain usable and rotate after their next successful authentication. KV remains only as a compatibility mirror while existing deployed connector keys migrate. R2 photos/documents arrive in the attachment phase together with staging and compensating cleanup; the v0.1 Worker deliberately does not declare an unused R2 binding.

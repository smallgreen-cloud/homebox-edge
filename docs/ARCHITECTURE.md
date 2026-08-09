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
      └── KV: revocable MCP keys
```

The HomeBox compatibility module is a pure domain boundary. It owns delimiter detection, RFC 4180 quoting, header aliases, value normalization, relationship validation, and canonical serialization. Storage receives validated immutable asset values and never parses CSV itself.

Import data flow:

```text
bounded request → CSV parse → schema validation → relationship validation
→ preview → explicit confirmation → owner-scoped D1 upsert → result summary
```

Export data flow:

```text
owner authentication → owner-scoped D1 query → domain mapping
→ canonical deterministic CSV → streamed response
```

Cross-service atomicity is intentionally narrow in v0.1: CSV rows live in D1 and can be transacted there. R2 photos/documents arrive in the attachment phase together with staging and compensating cleanup; the v0.1 Worker deliberately does not declare an unused R2 binding.

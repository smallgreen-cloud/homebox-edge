import { describe, expect, it } from "vitest";

import {
  HOMEBOX_COLLECTION_ENTRIES,
  parseHomeboxManifest,
} from "../src/compat/homebox-collection";

describe("HomeBox v0.26.2 collection contract", () => {
  it("pins schema v1 and the release table entries", () => {
    expect(HOMEBOX_COLLECTION_ENTRIES).toEqual([
      "entity_types.json",
      "entity_templates.json",
      "template_fields.json",
      "tags.json",
      "entities.json",
      "entity_fields.json",
      "maintenance_entries.json",
      "attachments.json",
      "tag_entities.json",
      "notifiers.json",
    ]);

    expect(
      parseHomeboxManifest({
        schemaVersion: 1,
        exportedAt: "2026-06-14T00:00:00Z",
        groupId: "11111111-1111-4111-8111-111111111111",
        homeboxVersion: "0.26.2",
        counts: { entities: 2, tags: 1 },
      }),
    ).toMatchObject({ schemaVersion: 1, homeboxVersion: "0.26.2" });
  });

  it("rejects unsupported schema versions and malformed counts", () => {
    expect(() =>
      parseHomeboxManifest({
        schemaVersion: 2,
        exportedAt: "2026-06-14T00:00:00Z",
        groupId: "11111111-1111-4111-8111-111111111111",
        counts: {},
      }),
    ).toThrow("unsupported HomeBox collection schema version");
    expect(() =>
      parseHomeboxManifest({
        schemaVersion: 1,
        exportedAt: "2026-06-14T00:00:00Z",
        groupId: "11111111-1111-4111-8111-111111111111",
        counts: { entities: -1 },
      }),
    ).toThrow();
  });
});

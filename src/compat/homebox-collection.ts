import { z } from "zod";

export const HOMEBOX_COLLECTION_SCHEMA_VERSION = 1;

export const HOMEBOX_COLLECTION_ENTRIES = [
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
] as const;

const ManifestSchema = z
  .object({
    schemaVersion: z.number().int(),
    exportedAt: z.iso.datetime({ offset: true }),
    groupId: z.uuid(),
    homeboxVersion: z.string().min(1).optional(),
    counts: z.record(z.string(), z.number().int().nonnegative()),
  })
  .passthrough();

export type HomeboxManifest = z.infer<typeof ManifestSchema>;

export function parseHomeboxManifest(input: unknown): HomeboxManifest {
  const manifest = ManifestSchema.parse(input);
  if (manifest.schemaVersion !== HOMEBOX_COLLECTION_SCHEMA_VERSION) {
    throw new Error(
      `unsupported HomeBox collection schema version ${manifest.schemaVersion}; expected ${HOMEBOX_COLLECTION_SCHEMA_VERSION}`,
    );
  }
  return manifest;
}

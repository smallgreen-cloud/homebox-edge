import { z } from "zod";

const OptionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional();

const HomeAssetObjectSchema = z
  .object({
    import_ref: OptionalText(100),
    parent_import_ref: OptionalText(100),
    location: z.array(z.string().trim().min(1).max(255)).max(32).default([]),
    tags: z.array(z.string().trim().min(1).max(255)).max(200).default([]),
    asset_id: z.string().regex(/^\d{3}-\d{3,}$/).optional(),
    archived: z.boolean().default(false),
    url: z.string().url().max(2_000).optional(),
    name: z.string().trim().min(1).max(255),
    quantity: z.number().finite().default(0),
    description: OptionalText(1_000),
    insured: z.boolean().default(false),
    notes: OptionalText(1_000),
    purchase_price: z.number().finite().default(0),
    purchase_from: OptionalText(255),
    purchase_date: z.iso.date().optional(),
    manufacturer: OptionalText(255),
    model_number: OptionalText(255),
    serial_number: OptionalText(255),
    lifetime_warranty: z.boolean().default(false),
    warranty_expires: z.iso.date().optional(),
    warranty_details: OptionalText(1_000),
    sold_to: OptionalText(255),
    sold_price: z.number().finite().default(0),
    sold_date: z.iso.date().optional(),
    sold_notes: OptionalText(1_000),
    custom_fields: z.record(z.string().min(1).max(255), z.string().max(500)).default({}),
  })
  .strict();

function hasValidParentReference(asset: {
  import_ref?: string;
  parent_import_ref?: string;
}): boolean {
  return (
    !asset.import_ref ||
    !asset.parent_import_ref ||
    asset.import_ref !== asset.parent_import_ref
  );
}

const ParentReferenceIssue = {
  message: "an asset cannot be its own parent",
  path: ["parent_import_ref"],
};

export const HomeAssetSchema = HomeAssetObjectSchema.refine(
  hasValidParentReference,
  ParentReferenceIssue,
);

export const HomeAssetPatchSchema = HomeAssetObjectSchema.partial()
  .strict()
  .refine(hasValidParentReference, ParentReferenceIssue);

export type HomeAsset = z.infer<typeof HomeAssetSchema>;
export type HomeAssetPatch = z.infer<typeof HomeAssetPatchSchema>;

export interface StoredHomeAsset extends HomeAsset {
  id: string;
  created_at: string;
  updated_at: string;
}

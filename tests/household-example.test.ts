import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseHomeboxCsv, renderHomeboxCsv } from "../src/compat/homebox-csv";
import { assertValidParentGraph } from "../src/core/parent-graph";

interface ExpectedHouseholdExample {
  data_classification: string;
  asset_count: number;
  active_count: number;
  archived_count: number;
  custom_fields: string[];
  parent_relationships: Record<string, string>;
}

const csv = readFileSync(
  new URL("../examples/homebox-v0.26.2-household-assets.csv", import.meta.url),
  "utf8",
);
const expected = JSON.parse(
  readFileSync(
    new URL("../examples/homebox-v0.26.2-household-assets.expected.json", import.meta.url),
    "utf8",
  ),
) as ExpectedHouseholdExample;

describe("HomeBox household deployment example", () => {
  it("is explicitly synthetic and represents common household equipment", () => {
    const assets = parseHomeboxCsv(csv);
    const names = assets.map((asset) => asset.name);

    expect(expected.data_classification).toBe("Synthetic for testing only");
    expect(names).toEqual(
      expect.arrayContaining([
        "Wi-Fi 路由器",
        "桌上型電腦主機",
        "外接螢幕",
        "外接備份硬碟",
        "工作筆電",
      ]),
    );
    expect(names).not.toEqual(expect.arrayContaining(["網路機櫃", "家庭伺服器", "NAS", "UPS"]));
    expect(
      assets.every(
        (asset) => asset.serial_number === undefined || asset.serial_number.startsWith("SYN-"),
      ),
    ).toBe(true);
  });

  it("matches the deployment validation manifest and has a valid parent graph", () => {
    const assets = parseHomeboxCsv(csv);
    const relationships = Object.fromEntries(
      assets
        .filter((asset) => asset.import_ref && asset.parent_import_ref)
        .map((asset) => [asset.import_ref!, asset.parent_import_ref!]),
    );

    expect(assets).toHaveLength(expected.asset_count);
    expect(assets.filter((asset) => !asset.archived)).toHaveLength(expected.active_count);
    expect(assets.filter((asset) => asset.archived)).toHaveLength(expected.archived_count);
    expect(relationships).toEqual(expected.parent_relationships);
    assertValidParentGraph(assets);
  });

  it("round trips every field through the canonical HomeBox serializer", () => {
    const assets = parseHomeboxCsv(csv);
    const rendered = renderHomeboxCsv(assets);
    const renderedHeader = rendered.slice(0, rendered.indexOf("\r\n")).split(",");

    expect(parseHomeboxCsv(rendered)).toEqual(assets);
    expect(renderedHeader.slice(-expected.custom_fields.length)).toEqual(
      expected.custom_fields.map((name) => `HB.field.${name}`),
    );
  });
});

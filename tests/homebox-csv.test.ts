import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  HOMEBOX_CANONICAL_HEADERS,
  HomeboxCsvError,
  parseHomeboxCsv,
  renderHomeboxCsv,
} from "../src/compat/homebox-csv";

const fixture = readFileSync(
  new URL("./fixtures/homebox-v0.26.2-all-fields.csv", import.meta.url),
  "utf8",
);

describe("HomeBox v0.26.2 CSV compatibility", () => {
  it("parses every pinned field, custom fields, tags, location and parent refs", () => {
    const [parent, child] = parseHomeboxCsv(fixture);

    expect(parent).toMatchObject({
      import_ref: "parent-ref",
      location: ["Home", "Storage"],
      tags: ["Important", "Tools"],
      asset_id: "000-042",
      name: "Toolbox",
      quantity: 1,
      insured: true,
      purchase_date: "2026-01-02",
      custom_fields: { Color: "Red" },
    });
    expect(child).toMatchObject({
      import_ref: "child-ref",
      parent_import_ref: "parent-ref",
      asset_id: "000-043",
      purchase_date: "2026-01-03",
      warranty_expires: "2027-01-03",
      custom_fields: { Color: "Blue", Voltage: "110V" },
    });
  });

  it("accepts TSV and legacy header aliases", () => {
    const input = [
      "HB.location\tHB.name\tHB.labels\tHB.purchase_time\tHB.sold_time",
      "Home / Office\tLaptop\tElectronics; Important\t2026/02/03\t2026-08-04T12:00:00Z",
    ].join("\n");

    expect(parseHomeboxCsv(input)[0]).toMatchObject({
      location: ["Home", "Office"],
      name: "Laptop",
      tags: ["Electronics", "Important"],
      purchase_date: "2026-02-03",
      sold_date: "2026-08-04",
    });
  });

  it("preserves finite negative values accepted by the pinned HomeBox entity schema", () => {
    const [asset] = parseHomeboxCsv(
      "HB.location,HB.name,HB.quantity,HB.purchase_price,HB.sold_price\nHome,Adjustment,-1,-10.5,-2",
    );
    expect(asset).toMatchObject({ quantity: -1, purchase_price: -10.5, sold_price: -2 });
  });

  it("enforces HomeBox text limits before data reaches storage", () => {
    const oversized = "x".repeat(1_001);
    expect(() =>
      parseHomeboxCsv(`HB.location,HB.name,HB.description\nHome,Thing,${oversized}`),
    ).toThrow("invalid row");
  });

  it("exports canonical headers, RFC 4180 quoting and sorted custom fields", () => {
    const assets = parseHomeboxCsv(fixture);
    const output = renderHomeboxCsv(assets);
    const header = output.slice(0, output.indexOf("\r\n")).split(",");

    expect(header.slice(0, HOMEBOX_CANONICAL_HEADERS.length)).toEqual(
      HOMEBOX_CANONICAL_HEADERS,
    );
    expect(header.slice(-2)).toEqual(["HB.field.Color", "HB.field.Voltage"]);
    expect(output).toContain('"Keeps sockets, bits"');
    expect(parseHomeboxCsv(output)).toEqual(assets);
  });

  it.each([
    ["missing required header", "HB.name,Other\nThing,x", "missing required headers"],
    [
      "ragged row",
      "HB.location,HB.name\nHome,Thing,extra",
      "columns",
    ],
    [
      "self parent",
      "HB.import_ref,HB.parent_import_ref,HB.location,HB.name\nsame,same,Home,Loop",
      "cannot be its own parent",
    ],
    [
      "duplicate ref",
      "HB.import_ref,HB.location,HB.name\nsame,Home,A\nsame,Home,B",
      "duplicate HB.import_ref",
    ],
  ])("rejects %s", (_name, input, message) => {
    expect(() => parseHomeboxCsv(input)).toThrowError(HomeboxCsvError);
    expect(() => parseHomeboxCsv(input)).toThrow(message);
  });
});

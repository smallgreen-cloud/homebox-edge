import { HomeAssetSchema, type HomeAsset } from "../core/asset";
import { PublicHttpError } from "../errors";

export const HOMEBOX_CANONICAL_HEADERS = [
  "HB.import_ref",
  "HB.parent_import_ref",
  "HB.location",
  "HB.tags",
  "HB.asset_id",
  "HB.archived",
  "HB.url",
  "HB.name",
  "HB.quantity",
  "HB.description",
  "HB.insured",
  "HB.notes",
  "HB.purchase_price",
  "HB.purchase_from",
  "HB.purchase_date",
  "HB.manufacturer",
  "HB.model_number",
  "HB.serial_number",
  "HB.lifetime_warranty",
  "HB.warranty_expires",
  "HB.warranty_details",
  "HB.sold_to",
  "HB.sold_price",
  "HB.sold_date",
  "HB.sold_notes",
] as const;

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 20_000;

export class HomeboxCsvError extends PublicHttpError {
  constructor(message: string, status: 400 | 413 = 400) {
    super(message, status);
    this.name = "HomeboxCsvError";
  }
}

function detectDelimiter(input: string): "," | "\t" {
  const end = input.search(/[\r\n]/);
  const firstLine = end === -1 ? input : input.slice(0, end);
  const comma = firstLine.indexOf(",");
  const tab = firstLine.indexOf("\t");
  if (comma === -1 && tab === -1) {
    throw new HomeboxCsvError("could not determine CSV or TSV separator");
  }
  return comma === -1 ? "\t" : ",";
}

function parseTable(input: string, delimiter: "," | "\t"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;

  const finishField = () => {
    row = [...row, field];
    field = "";
    closedQuote = false;
  };
  const finishRow = () => {
    finishField();
    rows.push(row);
    row = [];
    if (rows.length > MAX_ROWS + 1) {
      throw new HomeboxCsvError(`CSV exceeds ${MAX_ROWS} data rows`);
    }
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (closedQuote && character !== delimiter && character !== "\r" && character !== "\n") {
      throw new HomeboxCsvError("unexpected character after closing quote");
    }
    if (character === '"') {
      if (field.length > 0) throw new HomeboxCsvError("unexpected quote in unquoted field");
      quoted = true;
    } else if (character === delimiter) {
      finishField();
    } else if (character === "\n") {
      finishRow();
    } else if (character === "\r") {
      if (input[index + 1] === "\n") index += 1;
      finishRow();
    } else {
      field += character;
    }
  }

  if (quoted) throw new HomeboxCsvError("unterminated quoted field");
  if (field.length > 0 || row.length > 0) finishRow();
  return rows;
}

function splitList(value: string, separator: string): string[] {
  return value
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseBoolean(value: string): boolean {
  switch (value.trim().toLowerCase()) {
    case "1":
    case "t":
    case "true":
    case "yes":
      return true;
    case "0":
    case "f":
    case "false":
    case "no":
    case "":
      return false;
    default:
      return false;
  }
}

function parseNumber(value: string): number {
  if (value.trim() === "") return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: string): string | undefined {
  const input = value.trim();
  if (input === "") return undefined;
  let match = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!match) match = input.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) {
    const us = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (us) match = [us[0], us[3]!, us[1]!, us[2]!];
  }
  if (!match) return undefined;
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized
    ? undefined
    : normalized;
}

function parseAssetId(value: string): string | undefined {
  const compact = value.replaceAll('"', "").replaceAll("-", "").trim();
  if (compact === "") return undefined;
  if (!/^\d+$/.test(compact)) return undefined;
  const normalized = compact.replace(/^0+(?=\d)/, "").padStart(6, "0");
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}

function cell(row: readonly string[], index: Map<string, number>, ...headers: string[]): string {
  for (const header of headers) {
    const column = index.get(header);
    if (column !== undefined) return row[column] ?? "";
  }
  return "";
}

function classifyHomeboxUrl(value: string): {
  kind: "item" | "location";
  portableUrl?: string;
} {
  const trimmed = value.trim();
  if (trimmed === "") return { kind: "item" };

  let pathname: string;
  let isRelative = false;
  try {
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
      pathname = new URL(trimmed, "https://homebox.invalid").pathname;
      isRelative = true;
    } else {
      pathname = new URL(trimmed).pathname;
    }
  } catch {
    return { kind: "item", portableUrl: trimmed };
  }

  if (/^\/location\/[^/]+\/?$/.test(pathname)) return { kind: "location" };
  if (/^\/item\/[^/]+\/?$/.test(pathname) && isRelative) return { kind: "item" };
  return { kind: "item", portableUrl: trimmed };
}

export function parseHomeboxCsv(input: string): HomeAsset[] {
  if (new TextEncoder().encode(input).byteLength > MAX_CSV_BYTES) {
    throw new HomeboxCsvError("CSV exceeds 5 MB limit", 413);
  }
  const rows = parseTable(input, detectDelimiter(input));
  if (rows.length < 2) throw new HomeboxCsvError("sheet must have a header and at least one data row");
  const headers = [...rows[0]!];
  if (headers[0]) headers[0] = headers[0].replace(/^\uFEFF/, "");
  const index = new Map(headers.map((header, column) => [header, column]));
  if (!index.has("HB.location") || !index.has("HB.name")) {
    throw new HomeboxCsvError("missing required headers `HB.location` or `HB.name`");
  }
  const custom = headers
    .map((header, column) => ({ header, column }))
    .filter(({ header }) => header.startsWith("HB.field."));
  if (custom.some(({ header }) => header === "HB.field.")) {
    throw new HomeboxCsvError("custom field header requires a name");
  }

  const assets = rows.slice(1).flatMap((row, offset) => {
    if (row.length !== headers.length) {
      throw new HomeboxCsvError(
        `row ${offset + 2} has ${row.length} columns, expected ${headers.length}`,
      );
    }
    const entityUrl = classifyHomeboxUrl(cell(row, index, "HB.url"));
    // HomeBox exports locations and items through the same CSV shape. Its own
    // CSV import path expects callers to exclude location entity rows; they are
    // represented by each item's HB.location hierarchy instead.
    if (entityUrl.kind === "location") return [];
    const customFields = Object.fromEntries(
      custom
        .map(({ header, column }) => [header.slice("HB.field.".length), row[column] ?? ""] as const)
        .filter(([, value]) => value !== ""),
    );
    try {
      return [HomeAssetSchema.parse({
        import_ref: optional(cell(row, index, "HB.import_ref")),
        parent_import_ref: optional(cell(row, index, "HB.parent_import_ref")),
        location: splitList(cell(row, index, "HB.location"), "/"),
        tags: splitList(cell(row, index, "HB.tags", "HB.labels"), ";"),
        asset_id: parseAssetId(cell(row, index, "HB.asset_id")),
        archived: parseBoolean(cell(row, index, "HB.archived")),
        url: entityUrl.portableUrl,
        name: cell(row, index, "HB.name"),
        quantity: parseNumber(cell(row, index, "HB.quantity")),
        description: optional(cell(row, index, "HB.description")),
        insured: parseBoolean(cell(row, index, "HB.insured")),
        notes: optional(cell(row, index, "HB.notes")),
        purchase_price: parseNumber(cell(row, index, "HB.purchase_price")),
        purchase_from: optional(cell(row, index, "HB.purchase_from")),
        purchase_date: parseDate(cell(row, index, "HB.purchase_date", "HB.purchase_time")),
        manufacturer: optional(cell(row, index, "HB.manufacturer")),
        model_number: optional(cell(row, index, "HB.model_number")),
        serial_number: optional(cell(row, index, "HB.serial_number")),
        lifetime_warranty: parseBoolean(cell(row, index, "HB.lifetime_warranty")),
        warranty_expires: parseDate(cell(row, index, "HB.warranty_expires")),
        warranty_details: optional(cell(row, index, "HB.warranty_details")),
        sold_to: optional(cell(row, index, "HB.sold_to")),
        sold_price: parseNumber(cell(row, index, "HB.sold_price")),
        sold_date: parseDate(cell(row, index, "HB.sold_date", "HB.sold_time")),
        sold_notes: optional(cell(row, index, "HB.sold_notes")),
        custom_fields: customFields,
      })];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HomeboxCsvError(`invalid row ${offset + 2}: ${message}`);
    }
  });

  const refs = new Set<string>();
  for (const asset of assets) {
    if (asset.import_ref && refs.has(asset.import_ref)) {
      throw new HomeboxCsvError(`duplicate HB.import_ref ${JSON.stringify(asset.import_ref)}`);
    }
    if (asset.import_ref) refs.add(asset.import_ref);
    if (asset.import_ref && asset.import_ref === asset.parent_import_ref) {
      throw new HomeboxCsvError(`entity ${JSON.stringify(asset.import_ref)} cannot be its own parent`);
    }
  }
  return assets;
}

function escapeCsv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function valueForHeader(asset: HomeAsset, header: string): string {
  const values: Record<string, string> = {
    "HB.import_ref": asset.import_ref ?? "",
    "HB.parent_import_ref": asset.parent_import_ref ?? "",
    "HB.location": asset.location.join(" / "),
    "HB.tags": asset.tags.join("; "),
    "HB.asset_id": asset.asset_id ?? "",
    "HB.archived": String(asset.archived),
    "HB.url": asset.url ?? "",
    "HB.name": asset.name,
    "HB.quantity": String(asset.quantity),
    "HB.description": asset.description ?? "",
    "HB.insured": String(asset.insured),
    "HB.notes": asset.notes ?? "",
    "HB.purchase_price": String(asset.purchase_price),
    "HB.purchase_from": asset.purchase_from ?? "",
    "HB.purchase_date": asset.purchase_date ?? "",
    "HB.manufacturer": asset.manufacturer ?? "",
    "HB.model_number": asset.model_number ?? "",
    "HB.serial_number": asset.serial_number ?? "",
    "HB.lifetime_warranty": String(asset.lifetime_warranty),
    "HB.warranty_expires": asset.warranty_expires ?? "",
    "HB.warranty_details": asset.warranty_details ?? "",
    "HB.sold_to": asset.sold_to ?? "",
    "HB.sold_price": String(asset.sold_price),
    "HB.sold_date": asset.sold_date ?? "",
    "HB.sold_notes": asset.sold_notes ?? "",
  };
  return values[header] ?? asset.custom_fields[header.slice("HB.field.".length)] ?? "";
}

export function renderHomeboxCsv(input: readonly HomeAsset[]): string {
  const assets = input.map((asset) => {
    const stored = asset as HomeAsset & {
      id?: string;
      created_at?: string;
      updated_at?: string;
    };
    const {
      id: _id,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ...portable
    } = stored;
    return HomeAssetSchema.parse(portable);
  });
  const customHeaders = [
    ...new Set(assets.flatMap((asset) => Object.keys(asset.custom_fields))),
  ]
    .sort((left, right) => left.localeCompare(right))
    .map((name) => `HB.field.${name}`);
  const headers = [...HOMEBOX_CANONICAL_HEADERS, ...customHeaders];
  const rows = [
    headers,
    ...assets.map((asset) => headers.map((header) => valueForHeader(asset, header))),
  ];
  return `${rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")}\r\n`;
}

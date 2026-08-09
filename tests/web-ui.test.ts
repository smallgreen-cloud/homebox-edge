import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("mobile-first household inventory UI", () => {
  it("provides login, inventory, create and HomeBox import surfaces", async () => {
    const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
    expect(html).toContain('id="login"');
    expect(html).toContain('id="inventory"');
    expect(html).toContain('id="assetGrid"');
    expect(html).toContain('id="assetForm"');
    expect(html).toContain('id="importPanel"');
    expect(html).toContain('id="includeArchived"');
    expect(html).toContain('id="assetDialog"');
    expect(html).toContain('id="assetEditForm"');
    expect(html).toContain('id="keyList"');
    expect(html).toContain('href="/styles.css?v=0.1.0"');
    expect(html).toContain('src="/app.js?v=0.1.0"');
  });

  it("persists the owner session, supports file preview and uses accessible feedback", async () => {
    const script = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
    expect(script).toContain('localStorage.setItem("homeboxEdgeToken"');
    expect(script).toContain("/api/homebox/preview");
    expect(script).toContain("/api/homebox/import");
    expect(script).toContain('setAttribute("aria-busy"');
    expect(script).toContain("/api/keys/");
    expect(script).toContain("assetDialog.showModal()");
    expect(script).toContain("include_archived=true");
    expect(script).toContain("archived: false");
  });

  it("keeps the dialog close action readable on narrow screens", async () => {
    const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
    expect(styles).toContain(".dialog-heading > .text-button");
    expect(styles).toMatch(/\.dialog-heading > \.text-button\s*\{[^}]*white-space:\s*nowrap/s);
  });
});

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
    expect(html).toContain('href="/styles.css?v=0.3.0"');
    expect(html).toContain('src="/app.js?v=0.3.0"');
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

  it("keeps summary navigation and archive filtering within a 44px touch target", async () => {
    const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
    expect(styles).toMatch(/\.rail-link\s*\{[^}]*min-height:\s*2\.75rem/s);
    expect(styles).toMatch(/\.archive-filter\s*\{[^}]*min-height:\s*2\.75rem/s);
  });

  it("keeps the first asset within reach on a narrow bilingual layout", async () => {
    const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
    expect(styles).toMatch(
      /@media \(max-width: 45\.99rem\)[\s\S]*?\.inventory-main\s*\{[^}]*padding-top:\s*1rem/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 45\.99rem\)[\s\S]*?\.search-line\s*\{[^}]*margin-top:\s*1rem/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 45\.99rem\)[\s\S]*?\.asset-section\s*\{[^}]*margin-top:\s*1rem/s,
    );
  });

  it("puts the asset index before progressively disclosed tools", async () => {
    const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
    expect(html).toContain('id="openCreateButton"');
    expect(html).toContain('<details id="createPanel"');
    expect(html).not.toMatch(/<details id="createPanel"[^>]*\sopen(?:\s|>)/);
    expect(html.indexOf('id="assetGrid"')).toBeLessThan(html.indexOf('id="assetForm"'));
  });

  it("clears the active query and reduces destructive card action prominence", async () => {
    const script = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
    expect(script).toMatch(
      /clearSearchButton[\s\S]*?addEventListener\("click"[\s\S]*?await loadAssets\(""\)/,
    );
    expect(script).toContain('menu.className = "asset-menu"');
    expect(script).toContain("function renderAssetLoading()");
  });

  it("uses natural Traditional Chinese inventory terminology", async () => {
    const [html, script] = await Promise.all([
      readFile(new URL("../public/index.html", import.meta.url), "utf8"),
      readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    ]);
    expect(html).toContain('<h1 data-i18n="familyAssets">家庭資產</h1>');
    expect(html).not.toContain("台帳");
    expect(script).not.toContain("台帳");
  });

  it("supports a persistent Traditional Chinese and English interface", async () => {
    const [html, script] = await Promise.all([
      readFile(new URL("../public/index.html", import.meta.url), "utf8"),
      readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    ]);
    expect(html).toContain('id="languageButton"');
    expect(html).toContain('data-i18n="familyAssets"');
    expect(script).toContain('localStorage.getItem("homeboxEdgeLocale")');
    expect(script).toContain('localStorage.setItem("homeboxEdgeLocale"');
    expect(script).toContain('"zh-Hant": {');
    expect(script).toContain("en: {");
    expect(script).toContain("document.documentElement.lang = state.locale");
    expect(script).toContain('t("openRecord")');
    expect(script).toContain('t("assetCountActive")');
  });
});

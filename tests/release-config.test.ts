import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("release quality gate", () => {
  it("runs the complete verification suite in CI and reports failures", async () => {
    const workflow = await readFile(
      new URL("../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    );

    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm test");
    const generatedBindings = workflow.indexOf("run: npx wrangler types\n");
    const typecheck = workflow.indexOf("run: npm run typecheck");
    expect(generatedBindings).toBeGreaterThan(-1);
    expect(generatedBindings).toBeLessThan(typecheck);
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("wrangler types --check");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("npm audit --omit=dev --audit-level=high");
    expect(workflow).toContain("if: failure()");
    expect(workflow).toContain("issues: write");
  });
});

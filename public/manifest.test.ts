import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("PWA manifest.json", () => {
  const manifest = JSON.parse(
    readFileSync(join(__dirname, "../public/manifest.json"), "utf-8")
  ) as Record<string, unknown>;

  it("has a name field", () => {
    expect(typeof manifest.name).toBe("string");
    expect((manifest.name as string).length).toBeGreaterThan(0);
  });

  it("has a start_url field", () => {
    expect(manifest.start_url).toBeDefined();
  });

  it("has at least one icon entry", () => {
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect((manifest.icons as unknown[]).length).toBeGreaterThan(0);
  });

  it("has display set to standalone", () => {
    expect(manifest.display).toBe("standalone");
  });

  it("has a 512×512 maskable icon", () => {
    const icons = manifest.icons as Array<Record<string, string>>;
    const maskable = icons.find(
      (icon) => icon.purpose === "maskable" && icon.sizes === "512x512"
    );
    expect(maskable).toBeDefined();
  });
});

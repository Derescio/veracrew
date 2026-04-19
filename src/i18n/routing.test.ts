import { describe, it, expect } from "vitest";
import { routing } from "./routing";

describe("i18n routing config", () => {
  it("supports English and French locales", () => {
    expect(routing.locales).toContain("en");
    expect(routing.locales).toContain("fr");
    expect(routing.locales).toHaveLength(2);
  });

  it("defaults to English", () => {
    expect(routing.defaultLocale).toBe("en");
  });
});

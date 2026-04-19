import { describe, it, expect } from "vitest";
import { makeDocKey, makeImageKey, makeTemplateKey } from "./keys";

const ORG = "org123";

describe("makeDocKey", () => {
  it("produces an org-namespaced key", () => {
    const key = makeDocKey(ORG, "doc-1", "contract.pdf");
    expect(key).toBe(`org_${ORG}/docs/doc-1/contract.pdf`);
  });

  it("starts with org prefix", () => {
    expect(makeDocKey(ORG, "doc-1", "file.pdf")).toMatch(
      new RegExp(`^org_${ORG}/`)
    );
  });
});

describe("makeImageKey", () => {
  it("produces an org-namespaced image key", () => {
    const key = makeImageKey(ORG, "entity-1", "photo.jpg");
    expect(key).toBe(`org_${ORG}/images/entity-1/photo.jpg`);
  });
});

describe("makeTemplateKey", () => {
  it("produces an org-namespaced template key", () => {
    const key = makeTemplateKey(ORG, "tmpl-1", "form.pdf");
    expect(key).toBe(`org_${ORG}/templates/tmpl-1/form.pdf`);
  });
});

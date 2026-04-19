import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("hashes a password and verifies it successfully", async () => {
    const password = "correct-horse-battery-staple";
    const hash = await hashPassword(password);
    expect(typeof hash).toBe("string");
    expect(hash).not.toBe(password);
    expect(await verifyPassword(hash, password)).toBe(true);
  });

  it("returns false for an incorrect password", async () => {
    const hash = await hashPassword("correct-password");
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });

  it("generates different hashes for the same password (unique salts)", async () => {
    const password = "same-password";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(hash1, password)).toBe(true);
    expect(await verifyPassword(hash2, password)).toBe(true);
  });
});

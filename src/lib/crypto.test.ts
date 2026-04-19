import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "./crypto";

const TEST_KEY = "a".repeat(64);

describe("crypto", () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("encrypts and decrypts a string round-trip", () => {
    const plaintext = "my-super-secret-totp-key";
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("throws when ENCRYPTION_KEY is missing", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
  });

  it("throws when ENCRYPTION_KEY is wrong length", () => {
    process.env.ENCRYPTION_KEY = "tooshort";
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
  });
});

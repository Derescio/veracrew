import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as OTPAuth from "otpauth";
import { generateTotp, verifyTotp, generateBackupCodes, verifyBackupCode } from "./two-factor";

const TEST_KEY = "b".repeat(64);

describe("two-factor", () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  describe("generateTotp", () => {
    it("returns a secret, encryptedSecret, and otpauthUrl", () => {
      const result = generateTotp("user@example.com");
      expect(result.secret).toBeTruthy();
      expect(result.encryptedSecret).toBeTruthy();
      expect(result.encryptedSecret).not.toBe(result.secret);
      expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    });
  });

  describe("verifyTotp", () => {
    it("verifies a valid TOTP token", () => {
      const { secret, encryptedSecret } = generateTotp("user@example.com");

      const totp = new OTPAuth.TOTP({
        issuer: "Veracrew",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });
      const token = totp.generate();

      expect(verifyTotp(encryptedSecret, token)).toBe(true);
    });

    it("rejects an invalid TOTP token", () => {
      const { encryptedSecret } = generateTotp("user@example.com");
      expect(verifyTotp(encryptedSecret, "000000")).toBe(false);
    });
  });

  describe("generateBackupCodes", () => {
    it("generates the correct number of codes", async () => {
      const { plainCodes, hashedCodes } = await generateBackupCodes();
      expect(plainCodes).toHaveLength(8);
      expect(hashedCodes).toHaveLength(8);
    });

    it("all plain codes are unique hex strings", async () => {
      const { plainCodes } = await generateBackupCodes();
      const unique = new Set(plainCodes);
      expect(unique.size).toBe(8);
      plainCodes.forEach((code) => expect(/^[0-9a-f]+$/.test(code)).toBe(true));
    });
  });

  describe("verifyBackupCode", () => {
    it("returns the index of a valid backup code", async () => {
      const { plainCodes, hashedCodes } = await generateBackupCodes();
      const idx = await verifyBackupCode(plainCodes[2]!, hashedCodes);
      expect(idx).toBe(2);
    });

    it("returns -1 for an invalid backup code", async () => {
      const { hashedCodes } = await generateBackupCodes();
      const idx = await verifyBackupCode("not-a-real-code", hashedCodes);
      expect(idx).toBe(-1);
    });
  });
});

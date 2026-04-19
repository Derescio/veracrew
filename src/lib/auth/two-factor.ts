import * as OTPAuth from "otpauth";
import { randomBytes } from "crypto";
import { encrypt, decrypt } from "@/lib/crypto";

const TOTP_ISSUER = "Veracrew";
const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_BYTES = 5;

export interface TotpSetup {
  secret: string;
  encryptedSecret: string;
  otpauthUrl: string;
}

export interface BackupCodesResult {
  plainCodes: string[];
  hashedCodes: string[];
}

export function generateTotp(userEmail: string): TotpSetup {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: userEmail,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;
  const encryptedSecret = encrypt(secret);
  const otpauthUrl = totp.toString();

  return { secret, encryptedSecret, otpauthUrl };
}

export function verifyTotp(encryptedSecret: string, token: string): boolean {
  const secret = decrypt(encryptedSecret);
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // window: 1 allows ±30 seconds clock drift
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

export async function generateBackupCodes(): Promise<BackupCodesResult> {
  const { hashPassword } = await import("@/lib/auth/password");

  const plainCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    randomBytes(BACKUP_CODE_BYTES).toString("hex")
  );

  const hashedCodes = await Promise.all(plainCodes.map(hashPassword));

  return { plainCodes, hashedCodes };
}

/**
 * Verifies a plain backup code against the list of stored hashed codes.
 * Returns the index of the matching code, or -1 if none match.
 * The caller is responsible for removing the used code from storage.
 */
export async function verifyBackupCode(
  plainCode: string,
  hashedCodes: string[]
): Promise<number> {
  const { verifyPassword } = await import("@/lib/auth/password");

  for (let i = 0; i < hashedCodes.length; i++) {
    if (await verifyPassword(hashedCodes[i]!, plainCode)) {
      return i;
    }
  }
  return -1;
}

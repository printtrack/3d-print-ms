import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

/**
 * Symmetric encryption for secrets stored at rest in the DB (e.g. per-machine
 * printer-cloud tokens). AES-256-GCM. The key is derived from
 * PRINTER_SECRET_KEY, falling back to AUTH_SECRET (which the rest of the app
 * already requires) so no extra env var is strictly needed to get running.
 *
 * Ciphertext format: base64( iv[12] || authTag[16] || ciphertext ).
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const material = process.env.PRINTER_SECRET_KEY || process.env.AUTH_SECRET;
  if (!material) {
    throw new Error("PRINTER_SECRET_KEY or AUTH_SECRET must be set");
  }
  // Derive a fixed 32-byte key from the (arbitrary-length) secret material.
  return createHash("sha256").update(material).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf-8"
  );
}

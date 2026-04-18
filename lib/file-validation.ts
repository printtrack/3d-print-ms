type Checker = (buf: Buffer) => boolean;

const SIGNATURES: Record<string, Checker> = {
  ".jpg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".png": (b) =>
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  ".gif": (b) =>
    b.length >= 4 &&
    b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  ".webp": (b) =>
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  ".pdf": (b) =>
    b.length >= 4 &&
    b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  ".3mf": (b) =>
    b.length >= 4 &&
    b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
};

/**
 * Validates the magic bytes of a file buffer against known signatures.
 * Returns false if the content does not match the expected signature.
 * Returns true for extensions with no reliable magic bytes (STL, OBJ, gcode).
 */
export function validateFileContent(buffer: Buffer, ext: string): boolean {
  const check = SIGNATURES[ext.toLowerCase()];
  if (!check) return true;
  return check(buffer);
}

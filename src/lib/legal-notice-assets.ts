import fs from "fs";
import path from "path";

const SIGNATURE_FILENAME = "adv-kamble-signature.png";

function resolveImageMimeType(buffer: Buffer): string {
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  return "image/png";
}

/** Resolves advocate signature for @react-pdf/renderer (server-side). Returns null if absent. */
export function resolveAdvocateSignatureSrc(): string | null {
  const filePath = path.join(process.cwd(), "public", SIGNATURE_FILENAME);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const mimeType = resolveImageMimeType(buffer);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export const ADVOCATE_SIGNATURE_PUBLIC_PATH = `/${SIGNATURE_FILENAME}`;

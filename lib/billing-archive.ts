import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";

/**
 * Persist a rendered invoice PDF to disk under public/uploads/invoices/.
 * Returns the public path (e.g. "/uploads/invoices/RG-2026-0042.pdf") to store on Invoice.pdfPath.
 */
export async function archiveInvoicePdf(
  number: string,
  buffer: Buffer
): Promise<string> {
  const dir = path.join(getUploadDir(), "invoices");
  await mkdir(dir, { recursive: true });
  const safeName = number.replace(/[^A-Za-z0-9_.-]/g, "_");
  const filePath = path.join(dir, `${safeName}.pdf`);
  await writeFile(filePath, buffer);
  // Public URL (uses UPLOAD_DIR mounted under /uploads)
  return `/uploads/invoices/${safeName}.pdf`;
}

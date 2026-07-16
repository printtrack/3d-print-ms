import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import { getUploadDir } from "@/lib/uploads";
import { validateFileContent } from "@/lib/file-validation";
import { assertPermission } from "@/lib/authz";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

/**
 * Images for landing page blocks.
 *
 * Unlike the branding route, this returns an /api/files/... URL rather than
 * /uploads/... — UPLOAD_DIR is not necessarily inside public/ (see
 * DEPLOY-UBERSPACE.md), so the static path only works on some deployments.
 * `landing` is deliberately absent from AUTH_REQUIRED_PREFIXES in
 * app/api/files/[...path]/route.ts: these are public marketing images.
 */
export async function POST(req: NextRequest) {
  const guard = await assertPermission("landing.edit");
  if (guard) return guard;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Datei fehlt" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Bild darf maximal 5 MB groß sein" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.has(ext)) {
    return NextResponse.json(
      { error: `Nur ${[...ALLOWED].map((e) => e.slice(1).toUpperCase()).join(", ")} erlaubt` },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // The extension is the client's claim; the magic bytes are the evidence.
  if (ext !== ".svg" && !validateFileContent(buffer, ext)) {
    return NextResponse.json({ error: "Dateiinhalt ungültig" }, { status: 400 });
  }
  // SVG is markup, not pixels — it has no magic bytes and can carry script.
  if (ext === ".svg" && /<script|on\w+=/i.test(buffer.toString("utf8"))) {
    return NextResponse.json({ error: "SVG darf keine Scripte enthalten" }, { status: 400 });
  }

  const dir = path.join(getUploadDir(), "landing");
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(dir, filename), buffer);

  return NextResponse.json({ url: `/api/files/landing/${filename}` });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir, readdir, unlink } from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";
import { validateFileContent } from "@/lib/file-validation";
import { prisma } from "@/lib/db";

const MAX_LOGO_SIZE = 1024 * 1024; // 1 MB
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".svg"]);

function isAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Datei fehlt" }, { status: 400 });
  }
  if (file.size > MAX_LOGO_SIZE) {
    return NextResponse.json({ error: "Logo darf maximal 1 MB groß sein" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.has(ext)) {
    return NextResponse.json({ error: "Nur JPG, PNG oder SVG erlaubt" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (ext !== ".svg" && !validateFileContent(buffer, ext)) {
    return NextResponse.json({ error: "Dateiinhalt ungültig" }, { status: 400 });
  }
  if (ext === ".svg" && /<script|on\w+=/i.test(buffer.toString("utf8"))) {
    return NextResponse.json({ error: "SVG darf keine Scripte enthalten" }, { status: 400 });
  }

  const dir = path.join(getUploadDir(), "branding");
  await mkdir(dir, { recursive: true });

  for (const existing of await readdir(dir).catch(() => [])) {
    if (existing.startsWith("logo.")) {
      await unlink(path.join(dir, existing)).catch(() => {});
    }
  }

  const filename = `logo${ext}`;
  await writeFile(path.join(dir, filename), buffer);

  const publicPath = `/uploads/branding/${filename}`;
  await prisma.setting.upsert({
    where: { key: "billing_logo_url" },
    update: { value: publicPath },
    create: { key: "billing_logo_url", value: publicPath },
  });

  return NextResponse.json({ url: publicPath });
}

export async function DELETE() {
  const session = await auth();
  if (!isAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const dir = path.join(getUploadDir(), "branding");
  for (const existing of await readdir(dir).catch(() => [])) {
    if (existing.startsWith("logo.")) {
      await unlink(path.join(dir, existing)).catch(() => {});
    }
  }
  await prisma.setting.upsert({
    where: { key: "billing_logo_url" },
    update: { value: "" },
    create: { key: "billing_logo_url", value: "" },
  });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir, readdir, unlink } from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";
import { validateFileContent } from "@/lib/file-validation";
import { prisma } from "@/lib/db";

const MAX_LOGO_SIZE = 1024 * 1024; // 1 MB

// Two upload kinds share the same /branding folder. "logo" is the company logo
// (also used as the app/sidebar logo); "favicon" is the browser tab icon.
const KINDS = {
  logo: { prefix: "logo", settingKey: "billing_logo_url", allowed: new Set([".jpg", ".jpeg", ".png", ".svg"]) },
  favicon: { prefix: "favicon", settingKey: "brand_favicon_url", allowed: new Set([".png", ".svg", ".ico"]) },
} as const;

type Kind = keyof typeof KINDS;

function resolveKind(value: string | null): Kind {
  return value === "favicon" ? "favicon" : "logo";
}

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
  const kind = resolveKind(formData.get("kind") as string | null);
  const cfg = KINDS[kind];
  if (!file) {
    return NextResponse.json({ error: "Datei fehlt" }, { status: 400 });
  }
  if (file.size > MAX_LOGO_SIZE) {
    return NextResponse.json({ error: "Datei darf maximal 1 MB groß sein" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!cfg.allowed.has(ext)) {
    return NextResponse.json(
      { error: `Nur ${[...cfg.allowed].map((e) => e.slice(1).toUpperCase()).join(", ")} erlaubt` },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (ext !== ".svg" && ext !== ".ico" && !validateFileContent(buffer, ext)) {
    return NextResponse.json({ error: "Dateiinhalt ungültig" }, { status: 400 });
  }
  if (ext === ".svg" && /<script|on\w+=/i.test(buffer.toString("utf8"))) {
    return NextResponse.json({ error: "SVG darf keine Scripte enthalten" }, { status: 400 });
  }

  const dir = path.join(getUploadDir(), "branding");
  await mkdir(dir, { recursive: true });

  for (const existing of await readdir(dir).catch(() => [])) {
    if (existing.startsWith(`${cfg.prefix}.`)) {
      await unlink(path.join(dir, existing)).catch(() => {});
    }
  }

  const filename = `${cfg.prefix}${ext}`;
  await writeFile(path.join(dir, filename), buffer);

  const publicPath = `/uploads/branding/${filename}`;
  await prisma.setting.upsert({
    where: { key: cfg.settingKey },
    update: { value: publicPath },
    create: { key: cfg.settingKey, value: publicPath },
  });

  return NextResponse.json({ url: publicPath });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const kind = resolveKind(new URL(req.url).searchParams.get("kind"));
  const cfg = KINDS[kind];

  const dir = path.join(getUploadDir(), "branding");
  for (const existing of await readdir(dir).catch(() => [])) {
    if (existing.startsWith(`${cfg.prefix}.`)) {
      await unlink(path.join(dir, existing)).catch(() => {});
    }
  }
  await prisma.setting.upsert({
    where: { key: cfg.settingKey },
    update: { value: "" },
    create: { key: cfg.settingKey, value: "" },
  });
  return NextResponse.json({ ok: true });
}

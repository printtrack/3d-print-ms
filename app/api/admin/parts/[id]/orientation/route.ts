import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { Session } from "next-auth";

function isAdmin(session: Session | null) {
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

const patchSchema = z.object({
  qx: z.number(),
  qy: z.number(),
  qz: z.number(),
  qw: z.number(),
}).refine(
  ({ qx, qy, qz, qw }) => Math.abs(qx * qx + qy * qy + qz * qz + qw * qw - 1) < 1e-3,
  { message: "Quaternion must be normalized (|q| ≈ 1)" }
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const userId = (session.user as { id?: string }).id ?? null;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { qx, qy, qz, qw } = parsed.data;

  const part = await prisma.orderPart.findUnique({
    where: { id },
    select: { orderId: true, name: true },
  });
  if (!part) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.orderPart.update({
    where: { id },
    data: { orientQx: qx, orientQy: qy, orientQz: qz, orientQw: qw },
    select: { id: true, orientQx: true, orientQy: true, orientQz: true, orientQw: true },
  });

  await prisma.auditLog.create({
    data: {
      orderId: part.orderId,
      userId,
      action: "PART_ORIENTATION_SET",
      details: `Druckorientierung für Teil "${part.name}" gesetzt (qx=${qx.toFixed(4)}, qy=${qy.toFixed(4)}, qz=${qz.toFixed(4)}, qw=${qw.toFixed(4)})`,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const userId = (session.user as { id?: string }).id ?? null;

  const part = await prisma.orderPart.findUnique({
    where: { id },
    select: { orderId: true, name: true },
  });
  if (!part) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.orderPart.update({
    where: { id },
    data: { orientQx: 0, orientQy: 0, orientQz: 0, orientQw: 1 },
    select: { id: true, orientQx: true, orientQy: true, orientQz: true, orientQw: true },
  });

  await prisma.auditLog.create({
    data: {
      orderId: part.orderId,
      userId,
      action: "PART_ORIENTATION_RESET",
      details: `Druckorientierung für Teil "${part.name}" zurückgesetzt`,
    },
  });

  return NextResponse.json(updated);
}

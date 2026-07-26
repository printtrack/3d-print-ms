import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin, getActor } from "@/lib/authz";
import { z } from "zod";
import { replanParts } from "@/lib/job-replan";

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
  const guard = await assertAdmin();
  if (guard) return guard;
  const actor = await getActor();

  const { id } = await params;
  const userId = actor?.id ?? null;

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

  // The orientation decides footprint and height — re-batch the part.
  await replanParts([id], "Druckorientierung geändert", userId);

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await assertAdmin();
  if (guard) return guard;
  const actor = await getActor();

  const { id } = await params;
  const userId = actor?.id ?? null;

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

  await replanParts([id], "Druckorientierung zurückgesetzt", userId);

  return NextResponse.json(updated);
}

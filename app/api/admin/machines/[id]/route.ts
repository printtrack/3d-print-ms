import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";
import {
  decodeConnectionConfig,
  encodeConnectionConfig,
  getProfile,
  toPublicMachine,
  transportToConnectionType,
} from "@/lib/printers";
import type { PrinterConnectionConfig } from "@/lib/printers";
import { z } from "zod";

const connectionSchema = z.object({
  // Registry profile id (e.g. "prusa-core-one" / "ultimaker-s3" / "mock"), or
  // "none" to disconnect. Drives the transport + connectionType.
  profile: z.string(),
  // Empty token on edit = keep the existing one (never wiped implicitly).
  token: z.string().optional(),
  printerId: z.string().nullable().optional(),
  baseUrl: z.string().nullable().optional(),
  mockState: z
    .enum(["IDLE", "READY", "PRINTING", "PAUSED", "FINISHED", "ERROR", "OFFLINE"])
    .nullable()
    .optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  buildVolumeX: z.number().int().positive().optional(),
  buildVolumeY: z.number().int().positive().optional(),
  buildVolumeZ: z.number().int().positive().optional(),
  hourlyRate: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  connection: connectionSchema.optional(),
});


export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { id } = await params;

  try {
    const body = await req.json();
    const { connection, ...fields } = patchSchema.parse(body);

    const data: Record<string, unknown> = { ...fields };

    if (connection) {
      if (connection.profile === "none") {
        data.connectionType = "NONE";
        data.printerProfile = null;
        data.connectionConfigEnc = null;
      } else {
        const profile = getProfile(connection.profile);
        if (!profile) {
          return NextResponse.json({ error: "Unbekanntes Druckerprofil" }, { status: 400 });
        }
        const existing = await prisma.machine.findUnique({
          where: { id },
          select: { connectionConfigEnc: true, printerProfile: true, connectionType: true },
        });
        const prev = existing
          ? decodeConnectionConfig(existing)
          : ({} as PrinterConnectionConfig);
        const next: PrinterConnectionConfig = {
          // Keep the stored token unless a fresh non-empty one was supplied.
          token: connection.token && connection.token.length > 0
            ? connection.token
            : prev.token,
          printerId: connection.printerId ?? prev.printerId,
          baseUrl: connection.baseUrl ?? prev.baseUrl,
          mockState: connection.mockState ?? prev.mockState,
        };
        data.connectionType = transportToConnectionType(profile.transport);
        data.printerProfile = profile.id;
        data.connectionConfigEnc = encodeConnectionConfig(next);
      }
    }

    const machine = await prisma.machine.update({ where: { id }, data });

    return NextResponse.json(toPublicMachine(machine));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { id } = await params;

  const activeJobs = await prisma.printJob.count({
    where: { machineId: id, status: { in: ["PLANNED", "IN_PROGRESS"] } },
  });
  if (activeJobs > 0) {
    return NextResponse.json(
      { error: "Maschine kann nicht gelöscht werden – hat noch aktive Druckjobs" },
      { status: 400 }
    );
  }

  await prisma.machine.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

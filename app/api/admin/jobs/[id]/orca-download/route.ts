import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";
import { parseStl } from "@/lib/stl-parser";
import { buildThreeMF } from "@/lib/threemf-builder";
import type { ThreeMFObject, ThreeMFMetadata } from "@/lib/threemf-builder";
import { buildLabelMesh } from "@/lib/label-mesh";
import { resolveFilamentForPart } from "@/lib/filament-resolve";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await prisma.printJob.findUnique({
    where: { id },
    include: {
      machine: true,
      parts: {
        include: {
          orderPart: {
            select: {
              orderId: true,
              name: true,
              quantity: true,
              orientQx: true,
              orientQy: true,
              orientQz: true,
              orientQw: true,
              files: {
                where: { originalName: { contains: ".stl" } },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
              material: true,
              materialAny: true,
              color: true,
              colorAny: true,
              variantGroupId: true,
            },
          },
        },
      },
    },
  });

  if (!job) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const objects: ThreeMFObject[] = [];
  let objectId = 1;

  for (const jp of job.parts) {
    const part = jp.orderPart;
    // Own STL, or the shared design of the part's color-variant group.
    let latestStl: (typeof part.files)[number] | undefined = part.files[0];
    if (!latestStl && part.variantGroupId) {
      latestStl = await prisma.orderFile.findFirst({
        where: {
          orderId: part.orderId,
          originalName: { contains: ".stl" },
          orderPart: { variantGroupId: part.variantGroupId },
        },
        orderBy: { createdAt: "desc" },
      }) ?? undefined;
    }
    if (!latestStl) continue;

    const filePath = path.join(getUploadDir(), part.orderId, latestStl.filename);

    try {
      const buffer = await readFile(filePath);
      const mesh = parseStl(buffer);
      const { orientQx, orientQy, orientQz, orientQw } = part;
      const isIdentity = Math.abs(orientQx) < 1e-9 && Math.abs(orientQy) < 1e-9 && Math.abs(orientQz) < 1e-9 && Math.abs(orientQw - 1) < 1e-9;
      objects.push({
        id: objectId++,
        name: part.name,
        mesh,
        quantity: part.quantity ?? 1,
        transform: isIdentity ? undefined : { qx: orientQx, qy: orientQy, qz: orientQz, qw: orientQw },
      });
    } catch {
      // Skip files that cannot be read
    }
  }

  if (objects.length === 0) {
    return NextResponse.json({ error: "Keine STL-Dateien gefunden" }, { status: 404 });
  }

  // Append a plate-label mesh with the job's short code for identification
  const labelText = job.shortCode ?? id.slice(-6).toUpperCase();
  objects.push({
    id: objectId,
    name: `Label-${labelText}`,
    mesh: buildLabelMesh(labelText),
    quantity: 1,
  });

  // Collect unique filaments from parts by resolving each part's material+color
  // requirement to a concrete spool.
  const inventory = await prisma.filament.findMany({
    select: { id: true, name: true, material: true, color: true, colorHex: true, brand: true, isActive: true, remainingGrams: true },
  });
  const filamentMap = new Map<
    string,
    { material: string; color: string; colorHex: string | null; brand: string | null; name: string }
  >();
  for (const jp of job.parts) {
    const f = resolveFilamentForPart(jp.orderPart, inventory);
    if (f) {
      filamentMap.set(f.id, {
        material: f.material,
        color: f.color,
        colorHex: f.colorHex,
        brand: f.brand,
        name: f.name,
      });
    }
  }

  const metadata: ThreeMFMetadata = {
    machineName: job.machine.name,
    buildVolumeX: job.machine.buildVolumeX,
    buildVolumeY: job.machine.buildVolumeY,
    buildVolumeZ: job.machine.buildVolumeZ,
    filaments: [...filamentMap.values()],
  };

  const threeMfBuffer = await buildThreeMF(objects, metadata);

  return new NextResponse(threeMfBuffer.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "model/3mf",
      "Content-Disposition": `attachment; filename="job-${id}.3mf"`,
    },
  });
}

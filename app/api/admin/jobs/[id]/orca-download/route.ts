import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";
import { parseStl } from "@/lib/stl-parser";
import { buildThreeMF } from "@/lib/threemf-builder";
import type { ThreeMFObject, ThreeMFMetadata } from "@/lib/threemf-builder";

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
            include: {
              files: {
                where: {
                  originalName: { contains: ".stl" },
                },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
              filament: true,
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
    const latestStl = part.files[0];
    if (!latestStl) continue;

    const filePath = path.join(getUploadDir(), part.orderId, latestStl.filename);

    try {
      const buffer = await readFile(filePath);
      const mesh = parseStl(buffer);
      objects.push({
        id: objectId++,
        name: part.name,
        mesh,
        quantity: part.quantity ?? 1,
      });
    } catch {
      // Skip files that cannot be read
    }
  }

  if (objects.length === 0) {
    return NextResponse.json({ error: "Keine STL-Dateien gefunden" }, { status: 404 });
  }

  // Collect unique filaments from parts
  const filamentMap = new Map<
    string,
    { material: string; color: string; colorHex: string | null; brand: string | null; name: string }
  >();
  for (const jp of job.parts) {
    const f = jp.orderPart.filament;
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

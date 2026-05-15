import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";
import JSZip from "jszip";
import { buildLabelMesh, serializeStlBinary } from "@/lib/label-mesh";
import { rotateStlBuffer } from "@/lib/stl-transform";

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
            },
          },
        },
      },
    },
  });

  if (!job) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  for (const jp of job.parts) {
    const part = jp.orderPart;
    const latestStl = part.files[0];
    if (!latestStl) continue;

    const filePath = path.join(getUploadDir(), part.orderId, latestStl.filename);

    try {
      const rawBuffer = await readFile(filePath);
      const { orientQx, orientQy, orientQz, orientQw } = part;
      const buffer = rotateStlBuffer(rawBuffer, { qx: orientQx, qy: orientQy, qz: orientQz, qw: orientQw });
      // Deduplicate zip entry names
      const baseName = `${part.name}_${latestStl.originalName}`;
      const count = usedNames.get(baseName) ?? 0;
      usedNames.set(baseName, count + 1);
      const zipName = count === 0 ? baseName : `${baseName}_${count}`;
      zip.file(zipName, buffer);
    } catch {
      // Skip files that cannot be read
    }
  }

  // Append a plate-label STL for identification
  const labelText = job.shortCode ?? id.slice(-6).toUpperCase();
  const labelMesh = buildLabelMesh(labelText);
  zip.file(`label-${labelText}.stl`, serializeStlBinary(labelMesh));

  const zipBuffer = await zip.generateAsync({ type: "uint8array" });

  return new NextResponse(zipBuffer.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="job-${id}-stl-files.zip"`,
    },
  });
}

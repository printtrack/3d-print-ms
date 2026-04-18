import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getUploadDir } from "@/lib/uploads";
import { validateFileContent } from "@/lib/file-validation";
import { extractPrintTimeMinutes, extractFilamentData } from "@/lib/gcode-parser";

function colorDistance(hex1: string, hex2: string): number {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = new Set([".gcode", ".gco", ".bgcode", ".3mf"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await prisma.printJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "Keine Datei gefunden" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Datei zu groß (max 50MB)" }, { status: 400 });

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: "Nicht erlaubtes Dateiformat. Erlaubt: .gcode, .gco, .bgcode, .3mf" }, { status: 400 });
    }

    const uploadDir = path.join(getUploadDir(), "jobs", id);
    await mkdir(uploadDir, { recursive: true });

    const safeFilename = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, safeFilename);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateFileContent(buffer, ext)) {
      return NextResponse.json(
        { error: `Dateiinhalt entspricht nicht dem erwarteten Format: ${file.name}` },
        { status: 400 }
      );
    }
    await writeFile(filePath, buffer);

    await prisma.printJobFile.create({
      data: {
        printJobId: id,
        filename: safeFilename,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      },
    });

    // Extract print time and filament data from G-code files
    const gcodeExtensions = new Set([".gcode", ".gco"]);
    const jobUpdateData: Record<string, unknown> = {};
    const warnings: string[] = [];

    if (gcodeExtensions.has(ext)) {
      const extractedMinutes = extractPrintTimeMinutes(buffer);
      if (extractedMinutes !== null) {
        jobUpdateData.printTimeMinutes = extractedMinutes;
        jobUpdateData.printTimeFromGcode = true;
      }

      const filamentData = extractFilamentData(buffer);
      if (filamentData && filamentData.gramsPerSlot.length > 0) {
        // Collect unique filaments assigned to this job's parts
        const jobWithParts = await prisma.printJob.findUnique({
          where: { id },
          include: {
            parts: {
              include: {
                orderPart: {
                  select: {
                    filamentId: true,
                    filament: {
                      select: { id: true, name: true, material: true, colorHex: true, remainingGrams: true },
                    },
                  },
                },
              },
            },
          },
        });

        type JobFilament = { id: string; name: string; material: string; colorHex: string | null; remainingGrams: number };
        const filamentMap = new Map<string, JobFilament>();
        for (const jp of jobWithParts?.parts ?? []) {
          if (jp.orderPart.filament) {
            filamentMap.set(jp.orderPart.filament.id, jp.orderPart.filament);
          }
        }
        const filamentList = [...filamentMap.values()];

        if (filamentList.length > 0) {
          // Replace any previous filament usage records (re-upload scenario)
          await prisma.printJobFilament.deleteMany({ where: { printJobId: id } });

          const gramsMap = new Map<string, number>();

          for (let i = 0; i < filamentData.gramsPerSlot.length; i++) {
            const slotGrams = filamentData.gramsPerSlot[i];
            const slotMaterial = filamentData.materials[i]?.toUpperCase() ?? null;
            const slotColor = filamentData.colorHexes[i] ?? null;

            // Filter by material match; fall back to all filaments with a warning
            let candidates = slotMaterial
              ? filamentList.filter((f) => f.material.toUpperCase() === slotMaterial)
              : filamentList;

            if (candidates.length === 0) {
              const jobMaterials = [...new Set(filamentList.map((f) => f.material))].join(", ");
              warnings.push(
                `Materialwarnung: G-Code verwendet ${slotMaterial ?? "unbekanntes Material"}, aber im Job ist ${jobMaterials} eingeplant`
              );
              candidates = filamentList;
            }

            // Pick the best color match
            let best = candidates[0];
            if (slotColor && candidates.length > 1) {
              let minDist = Infinity;
              for (const c of candidates) {
                if (c.colorHex) {
                  const dist = colorDistance(slotColor, c.colorHex);
                  if (dist < minDist) { minDist = dist; best = c; }
                }
              }
            }

            gramsMap.set(best.id, (gramsMap.get(best.id) ?? 0) + slotGrams);
          }

          // Create records and check inventory sufficiency
          for (const [filamentId, grams] of gramsMap) {
            const rounded = Math.round(grams);
            await prisma.printJobFilament.create({
              data: { printJobId: id, filamentId, gramsActual: rounded },
            });
            const f = filamentList.find((f) => f.id === filamentId)!;
            if (rounded > f.remainingGrams) {
              warnings.push(
                `Nicht genug ${f.name}: ${rounded} g benötigt, aber nur ${f.remainingGrams} g auf Lager`
              );
            }
          }
        }
      }
    }

    // Auto-transition PLANNED → SLICED on first slice file upload
    if (job.status === "PLANNED") {
      jobUpdateData.status = "SLICED";
    }

    if (Object.keys(jobUpdateData).length > 0) {
      await prisma.printJob.update({ where: { id }, data: jobUpdateData });
    }

    const updated = await prisma.printJob.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, name: true } },
        parts: {
          include: {
            orderPart: {
              include: {
                order: { select: { id: true, customerName: true, customerEmail: true, description: true } },
                filament: { select: { id: true, name: true, material: true, color: true, colorHex: true } },
              },
            },
          },
        },
        filamentUsages: {
          include: {
            filament: { select: { id: true, name: true, material: true, color: true, colorHex: true } },
          },
        },
        files: { orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json({ job: updated, warnings }, { status: 201 });
  } catch (err) {
    console.error("Job file upload error:", err);
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 500 });
  }
}

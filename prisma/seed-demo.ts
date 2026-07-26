/**
 * Demo data for trying out the planner: real (generated) STL geometry, printers
 * with different build volumes, filament stock and a set of orders that each
 * exercise one planner behaviour.
 *
 *   npm run db:seed:demo          add demo data
 *   npm run db:seed:demo -- --reset   remove previous demo data first
 *
 * Everything it creates is tagged with DEMO_TAG, so --reset only touches its own
 * rows and leaves your real data alone.
 */
import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const DEMO_TAG = "[DEMO]";
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.cwd(), process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "public", "uploads");

// --- Minimal binary STL writer -------------------------------------------------

type Vec = [number, number, number];
type Tri = [Vec, Vec, Vec];

function normal(t: Tri): Vec {
  const [a, b, c] = t;
  const u: Vec = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: Vec = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: Vec = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const len = Math.hypot(...n) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

function toStl(tris: Tri[]): Buffer {
  const buf = Buffer.alloc(84 + tris.length * 50);
  buf.write("PrintTrack demo geometry", 0);
  buf.writeUInt32LE(tris.length, 80);
  let o = 84;
  for (const t of tris) {
    const n = normal(t);
    for (const value of [...n, ...t[0], ...t[1], ...t[2]]) {
      buf.writeFloatLE(value, o);
      o += 4;
    }
    buf.writeUInt16LE(0, o);
    o += 2;
  }
  return buf;
}

function quad(a: Vec, b: Vec, c: Vec, d: Vec): Tri[] {
  return [
    [a, b, c],
    [a, c, d],
  ];
}

/** Axis-aligned box with its origin corner at (x, y, z). */
function box(w: number, d: number, h: number, x = 0, y = 0, z = 0): Tri[] {
  const p = (i: number, j: number, k: number): Vec => [x + i * w, y + j * d, z + k * h];
  return [
    ...quad(p(0, 0, 0), p(1, 0, 0), p(1, 1, 0), p(0, 1, 0)), // bottom
    ...quad(p(0, 0, 1), p(0, 1, 1), p(1, 1, 1), p(1, 0, 1)), // top
    ...quad(p(0, 0, 0), p(0, 0, 1), p(1, 0, 1), p(1, 0, 0)),
    ...quad(p(1, 0, 0), p(1, 0, 1), p(1, 1, 1), p(1, 1, 0)),
    ...quad(p(1, 1, 0), p(1, 1, 1), p(0, 1, 1), p(0, 1, 0)),
    ...quad(p(0, 1, 0), p(0, 1, 1), p(0, 0, 1), p(0, 0, 0)),
  ];
}

function cylinder(radius: number, height: number, segments = 48): Tri[] {
  const tris: Tri[] = [];
  const top: Vec = [0, 0, height];
  const bottom: Vec = [0, 0, 0];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0: Vec = [Math.cos(a0) * radius, Math.sin(a0) * radius, 0];
    const p1: Vec = [Math.cos(a1) * radius, Math.sin(a1) * radius, 0];
    const q0: Vec = [p0[0], p0[1], height];
    const q1: Vec = [p1[0], p1[1], height];
    tris.push([bottom, p1, p0], [top, q0, q1], ...quad(p0, p1, q1, q0));
  }
  return tris;
}

function cone(radius: number, height: number, segments = 48): Tri[] {
  const tris: Tri[] = [];
  const apex: Vec = [0, 0, height];
  const center: Vec = [0, 0, 0];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0: Vec = [Math.cos(a0) * radius, Math.sin(a0) * radius, 0];
    const p1: Vec = [Math.cos(a1) * radius, Math.sin(a1) * radius, 0];
    tris.push([center, p1, p0], [apex, p0, p1]);
  }
  return tris;
}

/** L-shaped bracket — two boxes, looks like an actual part in the viewer. */
function bracket(len: number, width: number, height: number, thickness = 4): Tri[] {
  return [...box(len, width, thickness), ...box(thickness, width, height, 0, 0, 0)];
}

/** Plate with a grid of holes cut as separate rims — cheap but recognisable. */
function ventPlate(w: number, d: number, h: number): Tri[] {
  const tris = box(w, d, h);
  for (let i = 1; i <= 3; i++) {
    for (let j = 1; j <= 2; j++) {
      tris.push(...box(w / 12, d / 8, h + 1, (i * w) / 4 - w / 24, (j * d) / 3 - d / 16, -0.5));
    }
  }
  return tris;
}

const GEOMETRY: Record<string, { tris: Tri[]; file: string }> = {
  halter: { tris: bracket(80, 40, 60), file: "winkelhalter.stl" },
  duese: { tris: cone(18, 45), file: "duese.stl" },
  ring: { tris: cylinder(35, 12), file: "distanzring.stl" },
  wuerfel: { tris: box(45, 45, 45), file: "kalibrierwuerfel.stl" },
  platte: { tris: ventPlate(120, 80, 6), file: "lueftungsplatte.stl" },
  grossteil: { tris: box(300, 280, 260), file: "gehaeuse-gross.stl" },
  schildA: { tris: box(90, 50, 8), file: "schild-front.stl" },
  schildB: { tris: box(86, 46, 3, 2, 2, 8), file: "schild-schrift.stl" },
};

async function writeStl(orderId: string, key: keyof typeof GEOMETRY) {
  const geo = GEOMETRY[key];
  const filename = `${randomUUID()}.stl`;
  const dir = path.join(uploadDir, orderId);
  await mkdir(dir, { recursive: true });
  const buffer = toStl(geo.tris);
  await writeFile(path.join(dir, filename), buffer);
  return { filename, originalName: geo.file, size: buffer.length };
}

// --- Seed ----------------------------------------------------------------------

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

async function resetDemo() {
  const orders = await prisma.order.findMany({
    where: { description: { startsWith: DEMO_TAG } },
    select: { id: true },
  });
  const ids = orders.map((o) => o.id);
  if (ids.length > 0) {
    const parts = await prisma.orderPart.findMany({ where: { orderId: { in: ids } }, select: { id: true } });
    const partIds = parts.map((p) => p.id);
    const jobs = await prisma.printJob.findMany({
      where: { parts: { some: { orderPartId: { in: partIds } } } },
      select: { id: true },
    });
    await prisma.printJobPart.deleteMany({ where: { orderPartId: { in: partIds } } });
    // Jobs that only held demo parts are now empty — drop them.
    for (const job of jobs) {
      const left = await prisma.printJobPart.count({ where: { printJobId: job.id } });
      if (left === 0) await prisma.printJob.delete({ where: { id: job.id } });
    }
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.machine.deleteMany({ where: { name: { startsWith: DEMO_TAG } } });
  await prisma.filament.deleteMany({ where: { name: { startsWith: DEMO_TAG } } });
  console.log(`Demo-Daten entfernt (${ids.length} Aufträge).`);
}

async function main() {
  if (process.argv.includes("--reset")) await resetDemo();

  const orderPhase = await prisma.orderPhase.findFirst({ where: { name: "In Bearbeitung" } })
    ?? await prisma.orderPhase.findFirst({ where: { isDefault: true } });
  const printReady = await prisma.partPhase.findFirst({ where: { isPrintReady: true } });
  if (!orderPhase || !printReady) throw new Error("Phasen fehlen — erst `npm run db:seed` ausführen.");

  // --- Filament stock ---------------------------------------------------------
  const spools = [
    { key: "plaRot", material: "PLA", color: "Rot", colorHex: "#dc2626", remaining: 850 },
    { key: "plaWeiss", material: "PLA", color: "Weiß", colorHex: "#f8fafc", remaining: 640 },
    { key: "plaSchwarz", material: "PLA", color: "Schwarz", colorHex: "#0f172a", remaining: 900 },
    { key: "petgBlau", material: "PETG", color: "Blau", colorHex: "#2563eb", remaining: 520 },
  ] as const;

  const filaments: Record<string, string> = {};
  for (const s of spools) {
    const existing = await prisma.filament.findFirst({ where: { material: s.material, color: s.color } });
    if (existing) {
      filaments[s.key] = existing.id;
      continue;
    }
    const created = await prisma.filament.create({
      data: {
        name: `${DEMO_TAG} ${s.material} ${s.color}`,
        material: s.material,
        color: s.color,
        colorHex: s.colorHex,
        spoolWeightGrams: 1000,
        remainingGrams: s.remaining,
        pricePerKg: 24.9,
      },
    });
    filaments[s.key] = created.id;
  }

  // --- Printers ---------------------------------------------------------------
  // A multi-material machine so mixed-colour jobs have somewhere to go, and a
  // large one for the oversized part.
  const ams = await prisma.machine.create({
    data: {
      name: `${DEMO_TAG} Bambu X1C (AMS)`,
      buildVolumeX: 256,
      buildVolumeY: 256,
      buildVolumeZ: 256,
      materialSlots: 4,
      hourlyRate: 3.5,
      notes: "Vier Materialplätze — der Planer darf hier Farben mischen.",
    },
  });
  await prisma.machineFilamentSlot.createMany({
    data: [
      { machineId: ams.id, slot: 1, filamentId: filaments.plaRot },
      { machineId: ams.id, slot: 2, filamentId: filaments.plaWeiss },
      { machineId: ams.id, slot: 3, filamentId: null },
      { machineId: ams.id, slot: 4, filamentId: null },
    ],
  });

  const big = await prisma.machine.create({
    data: {
      name: `${DEMO_TAG} Großformat 400`,
      buildVolumeX: 400,
      buildVolumeY: 400,
      buildVolumeZ: 400,
      materialSlots: 1,
      hourlyRate: 5,
      notes: "Einziger Drucker, auf den das Gehäuse passt.",
    },
  });
  await prisma.machineFilamentSlot.create({
    data: { machineId: big.id, slot: 1, filamentId: filaments.plaSchwarz },
  });

  // --- Orders -----------------------------------------------------------------
  interface DemoPart {
    name: string;
    geo: keyof typeof GEOMETRY;
    material?: string | null;
    color?: string | null;
    materialAny?: boolean;
    colorAny?: boolean;
    colorHex?: string | null;
    grams?: number;
    quantity?: number;
    printReady?: boolean;
  }

  const orders: Array<{
    customerName: string;
    customerEmail: string;
    description: string;
    deadline: Date;
    parts: DemoPart[];
  }> = [
    {
      customerName: "Labor Steinbach",
      customerEmail: "steinbach@example.org",
      description: `${DEMO_TAG} Ersatzteile Messaufbau — eilig`,
      deadline: days(3),
      parts: [
        { name: "Winkelhalter", geo: "halter", material: "PLA", color: "Rot", colorHex: "#dc2626", grams: 45, quantity: 2 },
        { name: "Distanzring", geo: "ring", material: "PLA", color: "Rot", colorHex: "#dc2626", grams: 18, quantity: 4 },
      ],
    },
    {
      customerName: "Muster GmbH",
      customerEmail: "technik@muster.example",
      description: `${DEMO_TAG} Prototyp Gehäusedeckel — PETG`,
      deadline: days(9),
      parts: [
        { name: "Lüftungsplatte", geo: "platte", material: "PETG", color: "Blau", colorHex: "#2563eb", grams: 120 },
      ],
    },
    {
      customerName: "Hochschule Nordwest",
      customerEmail: "werkstatt@hs-nw.example",
      description: `${DEMO_TAG} Großes Gehäuse — passt nur auf den 400er`,
      deadline: days(7),
      parts: [
        { name: "Gehäuse groß", geo: "grossteil", material: "PLA", color: "Schwarz", colorHex: "#0f172a", grams: 780 },
      ],
    },
    {
      customerName: "Werkstatt Ahlers",
      customerEmail: "ahlers@example.net",
      description: `${DEMO_TAG} Serie Kalibrierwürfel — Farbe egal`,
      deadline: days(12),
      parts: [
        { name: "Kalibrierwürfel A", geo: "wuerfel", material: "PLA", colorAny: true, grams: 30 },
        { name: "Kalibrierwürfel B", geo: "wuerfel", material: "PLA", colorAny: true, grams: 30 },
        { name: "Düse", geo: "duese", material: "PLA", colorAny: true, grams: 12, quantity: 3 },
      ],
    },
    {
      customerName: "Schilderwerk Reuter",
      customerEmail: "reuter@example.com",
      description: `${DEMO_TAG} Zweifarbiges Schild — Multi-Material`,
      deadline: days(5),
      parts: [
        { name: "Schild Front", geo: "schildA", material: "PLA", color: "Weiß", colorHex: "#f8fafc", grams: 60 },
        { name: "Schild Schrift", geo: "schildB", material: "PLA", color: "Rot", colorHex: "#dc2626", grams: 15 },
      ],
    },
    {
      customerName: "Kunststoff Vogel",
      customerEmail: "vogel@example.org",
      description: `${DEMO_TAG} ASA-Teil — Material nicht auf Lager (bleibt liegen)`,
      deadline: days(6),
      parts: [
        { name: "ASA Halter", geo: "halter", material: "ASA", color: "Grau", grams: 55 },
      ],
    },
    {
      customerName: "Modellbau Kern",
      customerEmail: "kern@example.net",
      description: `${DEMO_TAG} Noch im Design — taucht bewusst nicht in der Planung auf`,
      deadline: days(20),
      parts: [
        { name: "Rumpfsegment", geo: "ring", material: "PLA", color: "Weiß", colorHex: "#f8fafc", grams: 40, printReady: false },
      ],
    },
  ];

  const designPhase = await prisma.partPhase.findFirst({ where: { isDefault: true } });

  for (const o of orders) {
    const order = await prisma.order.create({
      data: {
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        description: o.description,
        deadline: o.deadline,
        phaseId: orderPhase.id,
      },
    });

    for (const p of o.parts) {
      const part = await prisma.orderPart.create({
        data: {
          orderId: order.id,
          name: p.name,
          material: p.material ?? null,
          materialAny: p.materialAny ?? false,
          color: p.color ?? null,
          colorAny: p.colorAny ?? false,
          colorHex: p.colorHex ?? null,
          gramsEstimated: p.grams ?? null,
          quantity: p.quantity ?? 1,
          partPhaseId: (p.printReady ?? true) ? printReady.id : designPhase?.id ?? null,
        },
      });

      const file = await writeStl(order.id, p.geo);
      await prisma.orderFile.create({
        data: {
          orderId: order.id,
          orderPartId: part.id,
          filename: file.filename,
          originalName: file.originalName,
          mimeType: "model/stl",
          size: file.size,
          source: "TEAM",
          category: "DESIGN",
        },
      });
    }

    console.log(`  ✓ ${o.customerName} — ${o.parts.length} Teil(e)`);
  }

  console.log(`\nFertig. Öffne /admin/jobs — die Teile werden beim Laden automatisch zu Jobs gebündelt.`);
  console.log(`Danach „Auf Zeitachse planen" drücken, um die Terminierung zu sehen.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

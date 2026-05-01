import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const testDbUrl =
  process.env.DATABASE_URL_TEST ??
  "mysql://joberndo@localhost:3306/3dprinting_cms_test";

export const prismaTest = new PrismaClient({
  datasources: { db: { url: testDbUrl } },
});

// Pre-computed bcrypt hash of "admin123" with cost factor 12 — avoids ~300ms hashing per seed call
const ADMIN_HASH = "$2b$12$y2KSFIcuvvM4gjdMj9qAHuyZRS0XfB4KRW67T9Q5Pi9wP7ipk6HJG";

export async function resetDb() {
  await prismaTest.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0`);
  for (const table of [
    "AuditLog", "OrderComment", "OrderFile", "SurveyResponse", "VerificationRequest",
    "PrintJobAssignee", "PrintJobFilament", "PrintJobPart", "PrintJobFile", "PrintJob",
    "OrderPartAssignee", "OrderPart", "OrderAssignee", "Machine",
    "MilestoneTaskAssignee", "MilestoneTask", "Milestone", "Order",
    "OrderPhase", "PartPhase", "Filament",
    "ProjectAuditLog", "ProjectAssignee", "Project", "ProjectPhase",
    "KnowledgeEntry", "KnowledgeFile",
    "Session", "Account", "PasswordResetToken",
    "FilamentCredit", "Customer", "User", "VerificationToken",
  ]) {
    await prismaTest.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
  }
  await prismaTest.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1`);
}

export async function createTestCreditTransaction(
  customerId: string,
  amount: number,
  reason: string
) {
  const [credit] = await prismaTest.$transaction([
    prismaTest.filamentCredit.create({
      data: { customerId, amount, reason },
    }),
    prismaTest.customer.update({
      where: { id: customerId },
      data: { creditBalance: { increment: amount } },
    }),
  ]);
  return credit;
}

export async function createTestUser(
  overrides: Partial<{
    name: string;
    email: string;
    role: "ADMIN" | "TEAM_MEMBER";
  }> = {}
) {
  return prismaTest.user.create({
    data: {
      name: overrides.name ?? "Team Mitglied",
      email: overrides.email ?? `team-${Date.now()}@example.com`,
      password: "$2b$12$y2KSFIcuvvM4gjdMj9qAHuyZRS0XfB4KRW67T9Q5Pi9wP7ipk6HJG",
      role: overrides.role ?? "TEAM_MEMBER",
    },
  });
}

export async function createTestCustomer(
  overrides: Partial<{
    name: string;
    email: string;
    password: string;
  }> = {}
) {
  const password = overrides.password ?? "password123";
  const hashedPassword = await bcrypt.hash(password, 10);
  return prismaTest.customer.create({
    data: {
      name: overrides.name ?? "Test Kunde",
      email: overrides.email ?? "kunde@example.com",
      password: hashedPassword,
    },
  });
}

export async function createTestFilament(
  overrides: Partial<{
    name: string;
    material: string;
    color: string;
    colorHex: string;
    brand: string;
    spoolWeightGrams: number;
    remainingGrams: number;
    isActive: boolean;
  }> = {}
) {
  return prismaTest.filament.create({
    data: {
      name: overrides.name ?? "Test PLA Weiß",
      material: overrides.material ?? "PLA",
      color: overrides.color ?? "Weiß",
      colorHex: overrides.colorHex ?? "#FFFFFF",
      brand: overrides.brand ?? "Prusament",
      spoolWeightGrams: overrides.spoolWeightGrams ?? 1000,
      remainingGrams: overrides.remainingGrams ?? 800,
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function seedDb() {
  const admin = await prismaTest.user.create({
    data: {
      id: "test-admin-user-fixed-id",
      name: "Admin",
      email: "admin@3dprinting.local",
      password: ADMIN_HASH,
      role: "ADMIN",
    },
  });

  await prismaTest.orderPhase.createMany({
    data: [
      { name: "Eingegangen", color: "#6366f1", position: 0, isDefault: true },
      { name: "In Prüfung", color: "#f59e0b", position: 1 },
      { name: "In Bearbeitung", color: "#3b82f6", position: 2 },
      { name: "Abholbereit", color: "#10b981", position: 3 },
      { name: "Abgeschlossen", color: "#6b7280", position: 4 },
    ],
  });
  const phases = await prismaTest.orderPhase.findMany({ orderBy: { position: "asc" } });

  await prismaTest.partPhase.createMany({
    data: [
      { name: "Design", color: "#6366f1", position: 0, isDefault: true },
      { name: "Überprüfung", color: "#f59e0b", position: 1 },
      { name: "Druckbereit", color: "#10b981", position: 2, isPrintReady: true },
    ],
  });
  const partPhases = await prismaTest.partPhase.findMany({ orderBy: { position: "asc" } });

  await prismaTest.projectPhase.createMany({
    data: [
      { name: "Planung", color: "#6366f1", position: 0, isDefault: true },
      { name: "Aktiv", color: "#10b981", position: 1 },
      { name: "Pausiert", color: "#f59e0b", position: 2 },
      { name: "Abgeschlossen", color: "#6b7280", position: 3 },
      { name: "Archiviert", color: "#9ca3af", position: 4 },
    ],
  });
  const projectPhases = await prismaTest.projectPhase.findMany({ orderBy: { position: "asc" } });

  return { admin, phases, partPhases, projectPhases };
}

export async function createTestVerification(
  orderId: string,
  type: "DESIGN_REVIEW" | "PRICE_APPROVAL" = "DESIGN_REVIEW"
) {
  return prismaTest.verificationRequest.create({
    data: { orderId, type },
  });
}

export async function createTestMachine(
  overrides: Partial<{
    name: string;
    buildVolumeX: number;
    buildVolumeY: number;
    buildVolumeZ: number;
    isActive: boolean;
  }> = {}
) {
  return prismaTest.machine.create({
    data: {
      name: overrides.name ?? "Test Drucker",
      buildVolumeX: overrides.buildVolumeX ?? 220,
      buildVolumeY: overrides.buildVolumeY ?? 220,
      buildVolumeZ: overrides.buildVolumeZ ?? 250,
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function createTestPrintJobFile(
  printJobId: string,
  overrides: Partial<{
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
  }> = {}
) {
  return prismaTest.printJobFile.create({
    data: {
      printJobId,
      filename: overrides.filename ?? "test-file.gcode",
      originalName: overrides.originalName ?? "test.gcode",
      mimeType: overrides.mimeType ?? "application/octet-stream",
      size: overrides.size ?? 1024,
    },
  });
}

export async function createTestPrintJob(
  machineId: string,
  overrides: Partial<{
    status: "PLANNED" | "SLICED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
    queuePosition: number;
    plannedAt: Date;
    startedAt: Date;
    completedAt: Date;
    printTimeMinutes: number;
  }> = {}
) {
  return prismaTest.printJob.create({
    data: {
      machineId,
      status: overrides.status ?? "PLANNED",
      queuePosition: overrides.queuePosition ?? 0,
      plannedAt: overrides.plannedAt,
      startedAt: overrides.startedAt,
      completedAt: overrides.completedAt,
      printTimeMinutes: overrides.printTimeMinutes,
    },
  });
}

export async function createTestOrder(
  phaseId: string,
  overrides: Partial<{
    customerName: string;
    customerEmail: string;
    description: string;
    deadline: Date;
    isPrototype: boolean;
    iterationCount: number;
    isInternal: boolean;
    generalProject: boolean;
    estimatedCompletionAt: Date;
    projectId: string;
  }> = {}
) {
  return prismaTest.order.create({
    data: {
      customerName: overrides.customerName ?? "Test Customer",
      customerEmail: overrides.customerEmail ?? "test@example.com",
      description: overrides.description ?? "Test order description",
      phaseId,
      deadline: overrides.deadline,
      isPrototype: overrides.isPrototype ?? false,
      iterationCount: overrides.iterationCount ?? 1,
      isInternal: overrides.isInternal ?? false,
      generalProject: overrides.generalProject ?? false,
      estimatedCompletionAt: overrides.estimatedCompletionAt,
      projectId: overrides.projectId,
    },
  });
}

export async function createTestPartPhase(
  overrides: Partial<{
    name: string;
    color: string;
    position: number;
    isDefault: boolean;
    isPrintReady: boolean;
  }> = {}
) {
  const last = await prismaTest.partPhase.findFirst({ orderBy: { position: "desc" } });
  return prismaTest.partPhase.create({
    data: {
      name: overrides.name ?? "Test Phase",
      color: overrides.color ?? "#6366f1",
      position: overrides.position ?? (last?.position ?? -1) + 1,
      isDefault: overrides.isDefault ?? false,
      isPrintReady: overrides.isPrintReady ?? false,
    },
  });
}

export async function createTestOrderPart(
  orderId: string,
  overrides: Partial<{
    name: string;
    description: string;
    filamentId: string;
    gramsEstimated: number;
    partPhaseId: string;
    iterationCount: number;
  }> = {}
) {
  return prismaTest.orderPart.create({
    data: {
      orderId,
      name: overrides.name ?? "Test Teil",
      description: overrides.description,
      filamentId: overrides.filamentId,
      gramsEstimated: overrides.gramsEstimated,
      partPhaseId: overrides.partPhaseId,
      iterationCount: overrides.iterationCount ?? 1,
    },
  });
}

export async function createTestPrintJobPart(printJobId: string, orderPartId: string) {
  return prismaTest.printJobPart.create({
    data: { printJobId, orderPartId },
  });
}

export async function createTestMilestone(
  parentId: string,
  overrides: Partial<{
    name: string;
    description: string;
    dueAt: Date;
    color: string;
    position: number;
    useProjectId: boolean;
  }> = {}
) {
  const isProject = overrides.useProjectId ?? false;
  const where = isProject ? { projectId: parentId } : { orderId: parentId };
  const last = await prismaTest.milestone.findFirst({ where, orderBy: { position: "desc" } });
  return prismaTest.milestone.create({
    data: {
      ...(isProject ? { projectId: parentId } : { orderId: parentId }),
      name: overrides.name ?? "Test Meilenstein",
      description: overrides.description,
      dueAt: overrides.dueAt,
      color: overrides.color ?? "#6366f1",
      position: overrides.position ?? (last?.position ?? -1) + 1,
    },
  });
}

export async function createTestProjectPhase(
  overrides: Partial<{
    name: string;
    color: string;
    position: number;
    isDefault: boolean;
  }> = {}
) {
  const last = await prismaTest.projectPhase.findFirst({ orderBy: { position: "desc" } });
  return prismaTest.projectPhase.create({
    data: {
      name: overrides.name ?? "Test Projektphase",
      color: overrides.color ?? "#6366f1",
      position: overrides.position ?? (last?.position ?? -1) + 1,
      isDefault: overrides.isDefault ?? false,
    },
  });
}

export async function createTestProject(
  overrides: Partial<{
    name: string;
    description: string;
    projectPhaseId: string;
    deadline: Date;
  }> = {}
) {
  // If no projectPhaseId provided, use the default project phase
  let projectPhaseId = overrides.projectPhaseId;
  if (!projectPhaseId) {
    const defaultPhase = await prismaTest.projectPhase.findFirst({ where: { isDefault: true } });
    projectPhaseId = defaultPhase?.id;
  }
  if (!projectPhaseId) {
    throw new Error("No default project phase found. Run seedDb() first.");
  }
  return prismaTest.project.create({
    data: {
      name: overrides.name ?? "Test Projekt",
      description: overrides.description ?? null,
      projectPhaseId,
      deadline: overrides.deadline ?? null,
    },
  });
}

// Minimal binary STL with 1 triangle (134 bytes)
function makeMinimalStlBuffer(): Buffer {
  const buf = Buffer.alloc(134);
  // Header: 80 bytes of zeros (already zeroed)
  // Triangle count: 1
  buf.writeUInt32LE(1, 80);
  // Normal: (0, 0, 1)
  buf.writeFloatLE(0, 84);
  buf.writeFloatLE(0, 88);
  buf.writeFloatLE(1, 92);
  // Vertex 1: (0, 0, 0)
  buf.writeFloatLE(0, 96);
  buf.writeFloatLE(0, 100);
  buf.writeFloatLE(0, 104);
  // Vertex 2: (10, 0, 0)
  buf.writeFloatLE(10, 108);
  buf.writeFloatLE(0, 112);
  buf.writeFloatLE(0, 116);
  // Vertex 3: (0, 10, 0)
  buf.writeFloatLE(0, 120);
  buf.writeFloatLE(10, 124);
  buf.writeFloatLE(0, 128);
  // Attribute byte count: 0 (already zeroed)
  return buf;
}

/**
 * Creates an order with one part and a minimal STL file on disk,
 * linked as an OrderFile record. Returns the order and part.
 */
export async function createTestOrderWithStlFile() {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) throw new Error("No default order phase found. Run seedDb() first.");

  const order = await prismaTest.order.create({
    data: {
      customerName: "STL Test Customer",
      customerEmail: "stl@example.com",
      description: "STL test order",
      phaseId: defaultPhase.id,
    },
  });

  const part = await prismaTest.orderPart.create({
    data: {
      orderId: order.id,
      name: "Test STL Teil",
      quantity: 1,
    },
  });

  const filename = "test-model.stl";
  const uploadDir = process.env.UPLOAD_DIR
    ? path.resolve(process.cwd(), process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "public", "uploads");
  const orderDir = path.join(uploadDir, order.id);
  await mkdir(orderDir, { recursive: true });
  await writeFile(path.join(orderDir, filename), makeMinimalStlBuffer());

  const file = await prismaTest.orderFile.create({
    data: {
      orderId: order.id,
      orderPartId: part.id,
      filename,
      originalName: "test-model.stl",
      mimeType: "model/stl",
      size: 134,
    },
  });

  return { order, part, file };
}

/**
 * Creates a binary STL buffer with a single triangle whose vertices span
 * the given bounding box. The bbox parsed from this file will be (bboxX, bboxY, bboxZ).
 */
export function makeStlBuffer(bboxX: number, bboxY: number, bboxZ: number): Buffer {
  const buf = Buffer.alloc(134);
  buf.writeUInt32LE(1, 80);
  // Normal
  buf.writeFloatLE(0, 84); buf.writeFloatLE(0, 88); buf.writeFloatLE(1, 92);
  // Vertex 1: (0, 0, 0)
  buf.writeFloatLE(0, 96); buf.writeFloatLE(0, 100); buf.writeFloatLE(0, 104);
  // Vertex 2: (bboxX, 0, 0)
  buf.writeFloatLE(bboxX, 108); buf.writeFloatLE(0, 112); buf.writeFloatLE(0, 116);
  // Vertex 3: (0, bboxY, bboxZ)
  buf.writeFloatLE(0, 120); buf.writeFloatLE(bboxY, 124); buf.writeFloatLE(bboxZ, 128);
  return buf;
}

/**
 * Creates a print-ready part with STL file on disk and OrderFile record.
 * Requires seedDb() to have been called (for partPhases and orderPhases).
 */
export async function createTestPrintReadyPart(options: {
  filamentId: string;
  gramsEstimated?: number;
  quantity?: number;
  bboxX?: number;
  bboxY?: number;
  bboxZ?: number;
  name?: string;
}) {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) throw new Error("No default order phase. Run seedDb() first.");

  const printReadyPhase = await prismaTest.partPhase.findFirst({ where: { isPrintReady: true } });
  if (!printReadyPhase) throw new Error("No print-ready part phase. Run seedDb() first.");

  const order = await prismaTest.order.create({
    data: {
      customerName: options.name ?? "Planner Test",
      customerEmail: "planner@example.com",
      description: options.name ?? "Planner Test Order",
      phaseId: defaultPhase.id,
    },
  });

  const part = await prismaTest.orderPart.create({
    data: {
      orderId: order.id,
      name: options.name ?? "Test Teil",
      filamentId: options.filamentId,
      gramsEstimated: options.gramsEstimated,
      quantity: options.quantity ?? 1,
      partPhaseId: printReadyPhase.id,
    },
  });

  const stlBuf = makeStlBuffer(options.bboxX ?? 20, options.bboxY ?? 20, options.bboxZ ?? 20);
  const filename = `part-${part.id}.stl`;
  const uploadDir = process.env.UPLOAD_DIR
    ? path.resolve(process.cwd(), process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "public", "uploads");
  const orderDir = path.join(uploadDir, order.id);
  await mkdir(orderDir, { recursive: true });
  await writeFile(path.join(orderDir, filename), stlBuf);

  const file = await prismaTest.orderFile.create({
    data: {
      orderId: order.id,
      orderPartId: part.id,
      filename,
      originalName: filename,
      mimeType: "model/stl",
      size: stlBuf.length,
    },
  });

  return { order, part, file };
}

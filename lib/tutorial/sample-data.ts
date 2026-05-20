// Ephemeral mock data for the onboarding tutorial — never written to the DB.

export const TUTORIAL_ORDER_ID = "tutorial-order-1";
export const TUTORIAL_PART_ID = "tutorial-part-1";
export const TUTORIAL_FILAMENT_ID = "tutorial-filament-1";
export const TUTORIAL_FILE_ID = "tutorial-file-1";
export const TUTORIAL_JOB_ID_A = "tutorial-job-a";
export const TUTORIAL_JOB_ID_B = "tutorial-job-b";

export const TUTORIAL_PHASES = [
  { id: "tutorial-phase-1", name: "Eingegangen", color: "#6366f1", position: 0, isDefault: true, isPrototype: false },
  { id: "tutorial-phase-2", name: "In Prüfung", color: "#f59e0b", position: 1, isDefault: false, isPrototype: false },
  { id: "tutorial-phase-3", name: "Druckbereit", color: "#10b981", position: 2, isDefault: false, isPrototype: false },
];

const DEADLINE = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
const NOW = new Date().toISOString();

export const TUTORIAL_FILAMENT = {
  id: TUTORIAL_FILAMENT_ID,
  name: "PLA Grau",
  material: "PLA",
  color: "Grau",
  colorHex: "#9ca3af",
  brand: "Bambu",
  remainingGrams: 850,
};

// Part starts without filament — user selects it during tutorial
export const TUTORIAL_ORDER_KANBAN = {
  id: TUTORIAL_ORDER_ID,
  customerName: "Dr. M. Weber",
  customerEmail: "m.weber@gymnasium-leibniz.de",
  description: "3× Ersatz-Elektronen für Bohr'sches Atommodell (Klassensatz Klasse 11). Original-Teile gebrochen. Material: PLA Grau. Frist: 2 Wochen vor Schulstunde.",
  createdAt: NOW,
  updatedAt: NOW,
  deadline: DEADLINE,
  phase: { id: "tutorial-phase-1", name: "Eingegangen", color: "#6366f1" },
  phaseId: "tutorial-phase-1",
  phaseOrder: null,
  assignees: [] as Array<{ id: string; name: string; email: string }>,
  allAssignees: [] as Array<{ id: string; name: string; email: string; isTopLevel: boolean }>,
  files: [{ id: TUTORIAL_FILE_ID, filename: "elektronen-traeger.stl", mimeType: "model/stl" }],
  _count: { comments: 0 },
  priceEstimate: null,
  pendingVerification: false,
  isPrototype: false,
  iterationCount: 0,
  project: null,
  milestones: [],
  archivedAt: null,
  isInternal: false,
  trackingToken: "tutorial-token",
};

export const TUTORIAL_ORDER_DETAIL = {
  id: TUTORIAL_ORDER_ID,
  trackingToken: "tutorial-token",
  customerName: "Dr. M. Weber",
  customerEmail: "m.weber@gymnasium-leibniz.de",
  description: "3× Ersatz-Elektronen für Bohr'sches Atommodell (Klassensatz Klasse 11). Original-Teile gebrochen. Material: PLA Grau. Frist: 2 Wochen vor Schulstunde.",
  createdAt: NOW,
  updatedAt: NOW,
  archivedAt: null as string | null,
  deadline: DEADLINE,
  estimatedCompletionAt: null as string | null,
  priceEstimate: null as number | null,
  isPrototype: false,
  iterationCount: 0,
  phase: { id: "tutorial-phase-2", name: "In Prüfung", color: "#f59e0b", isPrototype: false },
  phaseId: "tutorial-phase-2",
  project: null,
  assignees: [] as Array<{ id: string; name: string; email: string }>,
  files: [
    {
      id: TUTORIAL_FILE_ID,
      filename: "elektronen-traeger.stl",
      originalName: "elektronen-traeger.stl",
      mimeType: "model/stl",
      size: 185000,
      source: "CUSTOMER" as const,
      category: "DESIGN" as const,
      orderPartId: TUTORIAL_PART_ID,
      createdAt: NOW,
      notes: [] as import("@/components/admin/files/types").NoteData[],
    },
  ],
  comments: [] as Array<{ id: string; content: string; sentToCustomer: boolean; createdAt: string; author: { id: string; name: string; email: string } }>,
  auditLogs: [
    { id: "tutorial-log-1", action: "ORDER_CREATED", details: null, createdAt: NOW, user: null },
  ],
  surveyResponse: null,
  // Pre-approved design review NOT needed here (no verification step in new flow)
  verificationRequests: [] as Array<{ id: string; type: "DESIGN_REVIEW" | "PRICE_APPROVAL"; status: "PENDING" | "APPROVED" | "REJECTED"; sentAt: string; resolvedAt: string | null; orderPartId: string | null; rejectionReason: string | null }>,
};

export const TUTORIAL_PARTS = [
  {
    id: TUTORIAL_PART_ID,
    orderId: TUTORIAL_ORDER_ID,
    name: "Elektronen-Träger",
    description: "PLA Grau, Bohr'sches Atommodell",
    filamentId: null as string | null,
    gramsEstimated: 8,
    quantity: 3,
    iterationCount: 0,
    partPhaseId: null as string | null,
    partPhase: null,
    orientQx: 0,
    orientQy: 0,
    orientQz: 0,
    orientQw: 1,
    createdAt: NOW,
    updatedAt: NOW,
    filament: null as { id: string; name: string; material: string; color: string; colorHex: string | null; brand: string | null } | null,
    files: [
      {
        id: TUTORIAL_FILE_ID,
        filename: "elektronen-traeger.stl",
        originalName: "elektronen-traeger.stl",
        mimeType: "model/stl",
        size: 185000,
        source: "CUSTOMER",
        category: "DESIGN",
        orderPartId: TUTORIAL_PART_ID,
        createdAt: NOW,
        notes: [] as import("@/components/admin/files/types").NoteData[],
      },
    ],
    printJobParts: [] as Array<{ printJobId: string; printJob: { id: string; status: string; machine: { name: string } } }>,
    assignees: [] as Array<{ user: { id: string; name: string; email: string } }>,
  },
];

export const TUTORIAL_MACHINES = [
  {
    id: "tutorial-machine-a",
    name: "Bambu X1C #1",
    buildVolumeX: 256,
    buildVolumeY: 256,
    buildVolumeZ: 256,
    hourlyRate: null as number | null,
    createdAt: NOW,
    updatedAt: NOW,
    isActive: true,
  },
];

export const TUTORIAL_PART_PHASES = [
  { id: "tpp-1", name: "Design", color: "#6366f1", isPrintReady: false, isReview: false, isPrinted: false, isMisprint: false },
  { id: "tpp-2", name: "Überprüfung", color: "#f59e0b", isPrintReady: false, isReview: true, isPrinted: false, isMisprint: false },
  { id: "tpp-3", name: "Druckbereit", color: "#10b981", isPrintReady: true, isReview: false, isPrinted: false, isMisprint: false },
  { id: "tpp-4", name: "Gedruckt", color: "#22c55e", isPrintReady: false, isReview: false, isPrinted: true, isMisprint: false },
];

function makeMockJob(id: string, machineId: string, machineName: string, status: string) {
  const withFilament = { ...TUTORIAL_FILAMENT };
  return {
    id,
    machineId,
    status: status as "PLANNED" | "SLICED" | "IN_PROGRESS" | "AWAITING_VERIFICATION" | "DONE" | "CANCELLED",
    shortCode: "T001",
    queuePosition: 1,
    plannedAt: NOW,
    startedAt: status !== "PLANNED" ? NOW : null,
    completedAt: status === "AWAITING_VERIFICATION" ? NOW : null,
    printTimeMinutes: 45,
    printTimeFromGcode: false,
    notes: null,
    machine: { id: machineId, name: machineName },
    parts: [{
      printJobId: id,
      orderPartId: TUTORIAL_PART_ID,
      addedAt: NOW,
      orderPart: {
        id: TUTORIAL_PART_ID,
        orderId: TUTORIAL_ORDER_ID,
        name: "Elektronen-Träger",
        filamentId: TUTORIAL_FILAMENT_ID,
        quantity: 3,
        files: [
          { id: TUTORIAL_FILE_ID, filename: "elektronen-traeger.stl", originalName: "elektronen-traeger.stl", mimeType: "model/stl", orderId: TUTORIAL_ORDER_ID },
        ],
        order: {
          id: TUTORIAL_ORDER_ID,
          customerName: "Dr. M. Weber",
          customerEmail: "m.weber@gymnasium-leibniz.de",
          description: "3× Ersatz-Elektronen Atommodell",
        },
        filament: withFilament,
      },
    }],
    filamentUsages: [] as Array<{ id: string; gramsActual: number; filament: { id: string; name: string; material: string; color: string; colorHex: string | null } }>,
    files: [],
    assignees: [] as Array<{ user: { id: string; name: string; email: string } }>,
  };
}

export function getTutorialJobs(printSimulated: boolean) {
  const status = printSimulated ? "AWAITING_VERIFICATION" : "PLANNED";
  return [makeMockJob(TUTORIAL_JOB_ID_A, "tutorial-machine-a", "Bambu X1C #1", status)];
}

// Intercepts /api/admin/* calls during tutorial mode — no real DB writes.

import { TUTORIAL_ORDER_ID, TUTORIAL_PART_ID, TUTORIAL_JOB_ID_A, TUTORIAL_FILAMENT_ID, TUTORIAL_FILAMENT, TUTORIAL_PART_PHASES } from "./sample-data";

interface MockHandlerOptions {
  onOrderMoved: (phaseId: string) => void;
  onFilamentSelected: () => void;
  onPartPhaseSet: () => void;
  onJobsPlanned: () => void;
  onJobVerified: () => void;
}

const ORDER_PATCH_RE = /\/api\/admin\/orders\/([^/?]+)(\?.*)?$/;
const PART_PATCH_RE = /\/api\/admin\/orders\/[^/]+\/parts\/([^/?]+)(\?.*)?$/;
const JOBS_PLAN_RE = /\/api\/admin\/jobs\/plan$/;
const JOBS_PLAN_COMMIT_RE = /\/api\/admin\/jobs\/plan\/commit$/;
const JOB_GET_RE = /\/api\/admin\/jobs\/(tutorial-job-[ab])(\?.*)?$/;
const JOB_VERIFY_PARTS_RE = /\/api\/admin\/jobs\/([^/]+)\/verify-parts$/;
const JOBS_AUTO_RE = /\/api\/admin\/jobs\/auto-transition$/;
const ORDERS_REORDER_RE = /\/api\/admin\/orders\/reorder$/;
const COMMENTS_RE = /\/api\/admin\/comments$/;

const NOW = new Date().toISOString();

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeJob(id: string, machineId: string, machineName: string, status: string) {
  return {
    id, machineId, status,
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
          { id: "tutorial-file-1", filename: "elektronen-traeger.stl", originalName: "elektronen-traeger.stl", mimeType: "model/stl", orderId: TUTORIAL_ORDER_ID },
        ],
        order: { id: TUTORIAL_ORDER_ID, customerName: "Dr. M. Weber", customerEmail: "m.weber@gymnasium-leibniz.de", description: "3× Ersatz-Elektronen Atommodell" },
        filament: TUTORIAL_FILAMENT,
      },
    }],
    filamentUsages: [],
    files: [],
    assignees: [],
  };
}

export function createMockFetchHandler(opts: MockHandlerOptions) {
  return async function mockFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response | null> {
    const url = typeof input === "string" ? input : (input instanceof URL ? input.toString() : (input as Request).url);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    // Harmless passthrough
    if (ORDERS_REORDER_RE.test(url)) return jsonResponse({ ok: true });
    if (JOBS_AUTO_RE.test(url) && method === "POST") return jsonResponse({ started: [], completed: [] });
    if (COMMENTS_RE.test(url) && method === "POST") {
      return jsonResponse({ id: "tut-comment", content: "", createdAt: NOW, author: { id: "admin", name: "Admin", email: "" } });
    }

    // Part PATCH — filament or phase change (before order PATCH test)
    if (PART_PATCH_RE.test(url) && method === "PATCH") {
      const body = init?.body ? JSON.parse(init.body as string) : {};

      if ("filamentId" in body) {
        const filament = body.filamentId === TUTORIAL_FILAMENT_ID ? TUTORIAL_FILAMENT : null;
        opts.onFilamentSelected();
        return jsonResponse({
          id: TUTORIAL_PART_ID, orderId: TUTORIAL_ORDER_ID,
          name: "Elektronen-Träger", filamentId: body.filamentId ?? null,
          filament, quantity: 3, partPhaseId: null, partPhase: null,
          gramsEstimated: 8, iterationCount: 0,
          orientQx: 0, orientQy: 0, orientQz: 0, orientQw: 1,
          createdAt: NOW, updatedAt: NOW,
          files: [], printJobParts: [], assignees: [],
        });
      }

      if ("partPhaseId" in body) {
        const partPhase = TUTORIAL_PART_PHASES.find((p) => p.id === body.partPhaseId) ?? null;
        opts.onPartPhaseSet();
        return jsonResponse({
          id: TUTORIAL_PART_ID, orderId: TUTORIAL_ORDER_ID,
          name: "Elektronen-Träger", filamentId: TUTORIAL_FILAMENT_ID,
          filament: TUTORIAL_FILAMENT, quantity: 3,
          partPhaseId: body.partPhaseId ?? null, partPhase,
          gramsEstimated: 8, iterationCount: 0,
          orientQx: 0, orientQy: 0, orientQz: 0, orientQw: 1,
          createdAt: NOW, updatedAt: NOW,
          files: [], printJobParts: [], assignees: [],
        });
      }

      return jsonResponse({ id: TUTORIAL_PART_ID, ...body });
    }

    // Order PATCH — phase or other fields
    if (ORDER_PATCH_RE.test(url) && method === "PATCH") {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      if (body.phaseId) opts.onOrderMoved(body.phaseId);
      return jsonResponse({ id: TUTORIAL_ORDER_ID, ...body });
    }

    // Plan — get proposal
    if (JOBS_PLAN_RE.test(url) && method === "POST") {
      return jsonResponse({
        proposed: [
          {
            type: "new",
            machineId: "tutorial-machine-a",
            machineName: "Bambu X1C #1",
            filamentLabel: "PLA Grau",
            utilizationPct: 24,
            estimatedGramsTotal: 24,
            parts: [{ orderPartId: TUTORIAL_PART_ID, partName: "Elektronen-Träger", quantity: 3 }],
          },
        ],
        skipped: [],
      });
    }

    // Plan commit
    if (JOBS_PLAN_COMMIT_RE.test(url) && method === "POST") {
      opts.onJobsPlanned();
      return jsonResponse({ created: [{ id: TUTORIAL_JOB_ID_A }] });
    }

    // Job GET (after commit)
    if (JOB_GET_RE.test(url) && method === "GET") {
      return jsonResponse(makeJob(TUTORIAL_JOB_ID_A, "tutorial-machine-a", "Bambu X1C #1", "PLANNED"));
    }

    // Job verify-parts
    if (JOB_VERIFY_PARTS_RE.test(url) && method === "POST") {
      opts.onJobVerified();
      return jsonResponse({ ok: true });
    }

    return null;
  };
}

export function installFetchInterceptor(handler: ReturnType<typeof createMockFetchHandler>): () => void {
  const original = window.fetch;
  window.fetch = async (input, init) => {
    const result = await handler(input, init);
    if (result !== null) return result;
    return original(input, init);
  };
  return () => {
    window.fetch = original;
  };
}

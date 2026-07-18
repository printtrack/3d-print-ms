import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { getUploadDir } from "@/lib/uploads";
import { publish } from "@/lib/event-bus";
import { getProvider, isAutoStartAllowed, isConnected } from "@/lib/printers";
import type { PrinterStatus } from "@/lib/printers";

/** Dispatch statuses that are still "in flight" and worth polling. */
export const ACTIVE_DISPATCH_STATUSES = [
  "UPLOADED",
  "HELD",
  "STARTED",
  "PRINTING",
] as const;

export class DispatchError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number
  ) {
    super(message);
  }
}

async function writeJobAudit(
  jobId: string,
  action: string,
  details: string,
  userId: string | null
) {
  const parts = await prisma.printJobPart.findMany({
    where: { printJobId: jobId },
    select: { orderPart: { select: { orderId: true } } },
  });
  const orderIds = [...new Set(parts.map((p) => p.orderPart.orderId))];
  if (orderIds.length === 0) return;
  await prisma.auditLog.createMany({
    data: orderIds.map((orderId) => ({ orderId, userId, action, details })),
  });
}

/** Reads a print-job file from disk. Files live at UPLOAD_DIR/jobs/{jobId}/{name}. */
async function readJobFile(jobId: string, filename: string): Promise<Buffer> {
  return readFile(path.join(getUploadDir(), "jobs", jobId, filename));
}

interface CreateDispatchArgs {
  jobId: string;
  /** Optional explicit file; defaults to the newest file on the job. */
  fileId?: string;
  actorId: string | null;
  autoStart?: boolean;
}

/**
 * Sends a job's sliced file to its machine's printer. Auto-start only fires when
 * the printer reports it is truly idle and the bed is clear; otherwise the file
 * is uploaded and the dispatch waits in HELD for a manual start.
 *
 * Throws DispatchError for caller-fixable problems (no file, not connected).
 * Provider/network failures are recorded as a FAILED dispatch and returned with
 * httpStatus 502 so the UI can show the error while keeping an audit trail.
 */
export async function createDispatch({
  jobId,
  fileId,
  actorId,
  autoStart = true,
}: CreateDispatchArgs): Promise<{ dispatch: unknown; httpStatus: number }> {
  const job = await prisma.printJob.findUnique({
    where: { id: jobId },
    include: {
      machine: true,
      files: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!job) throw new DispatchError("Job nicht gefunden", 404);

  if (!isConnected(job.machine)) {
    throw new DispatchError("Drucker ist nicht verbunden", 409);
  }

  const file = fileId
    ? job.files.find((f) => f.id === fileId)
    : job.files[0];
  if (!file) {
    throw new DispatchError("Keine Druckdatei am Job vorhanden", 400);
  }

  const provider = getProvider(job.machine);

  // 1) Read printer status (also refreshes the cached machine state).
  let status: PrinterStatus;
  try {
    status = await provider.getPrinterStatus();
    await prisma.machine.update({
      where: { id: job.machineId },
      data: { lastSeenState: status.state, lastSeenAt: new Date() },
    });
  } catch (err) {
    const dispatch = await prisma.printDispatch.create({
      data: {
        printJobId: jobId,
        machineId: job.machineId,
        printJobFileId: file.id,
        status: "FAILED",
        autoStart,
        error: err instanceof Error ? err.message : String(err),
        createdBy: actorId,
        finishedAt: new Date(),
      },
    });
    publish({ type: "job.changed", jobId });
    return { dispatch, httpStatus: 502 };
  }

  // 2) Upload the file. The start decision is folded into the upload so backends
  //    without a separate start endpoint (Prusa Connect) print in one call.
  try {
    const canStart = autoStart && isAutoStartAllowed(status);
    const buffer = await readJobFile(jobId, file.filename);
    const { providerRef } = await provider.uploadJob(
      {
        buffer,
        filename: file.originalName,
        mimeType: file.mimeType,
      },
      { startAfterUpload: canStart }
    );

    if (canStart) {
      const dispatch = await prisma.printDispatch.create({
        data: {
          printJobId: jobId,
          machineId: job.machineId,
          printJobFileId: file.id,
          status: "STARTED",
          autoStart,
          providerRef,
          startedAt: new Date(),
          createdBy: actorId,
        },
      });
      if (job.status !== "IN_PROGRESS") {
        await prisma.printJob.update({
          where: { id: jobId },
          data: { status: "IN_PROGRESS", startedAt: new Date() },
        });
      }
      await writeJobAudit(
        jobId,
        "JOB_STARTED",
        `Druck auf ${job.machine.name} gestartet`,
        actorId
      );
      publish({ type: "job.changed", jobId });
      return { dispatch, httpStatus: 201 };
    }

    // Printer busy / bed occupied → upload only, wait for a manual start.
    const holdReason =
      status.state === "FINISHED" || status.bedOccupied
        ? "bed_occupied"
        : "printer_busy";
    const dispatch = await prisma.printDispatch.create({
      data: {
        printJobId: jobId,
        machineId: job.machineId,
        printJobFileId: file.id,
        status: "HELD",
        autoStart,
        providerRef,
        holdReason,
        createdBy: actorId,
      },
    });
    await writeJobAudit(
      jobId,
      "JOB_DISPATCHED",
      `Datei an ${job.machine.name} gesendet (wartet: ${holdReason})`,
      actorId
    );
    publish({ type: "job.changed", jobId });
    return { dispatch, httpStatus: 201 };
  } catch (err) {
    const dispatch = await prisma.printDispatch.create({
      data: {
        printJobId: jobId,
        machineId: job.machineId,
        printJobFileId: file.id,
        status: "FAILED",
        autoStart,
        error: err instanceof Error ? err.message : String(err),
        createdBy: actorId,
        finishedAt: new Date(),
      },
    });
    publish({ type: "job.changed", jobId });
    return { dispatch, httpStatus: 502 };
  }
}

/** Manually start a HELD dispatch (operator confirmed the bed is clear). */
export async function startHeldDispatch(
  dispatchId: string,
  actorId: string | null
): Promise<unknown> {
  const dispatch = await prisma.printDispatch.findUnique({
    where: { id: dispatchId },
    include: { machine: true, printJob: { select: { status: true } } },
  });
  if (!dispatch) throw new DispatchError("Dispatch nicht gefunden", 404);
  if (dispatch.status !== "HELD") {
    throw new DispatchError("Dispatch wartet nicht auf Start", 409);
  }
  if (!dispatch.providerRef) {
    throw new DispatchError("Keine Druckerreferenz vorhanden", 409);
  }

  const provider = getProvider(dispatch.machine);
  try {
    await provider.startPrint(dispatch.providerRef);
  } catch (err) {
    await prisma.printDispatch.update({
      where: { id: dispatchId },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
      },
    });
    publish({ type: "job.changed", jobId: dispatch.printJobId });
    throw new DispatchError(
      err instanceof Error ? err.message : "Start fehlgeschlagen",
      502
    );
  }

  const updated = await prisma.printDispatch.update({
    where: { id: dispatchId },
    data: { status: "STARTED", startedAt: new Date() },
  });
  if (dispatch.printJob.status !== "IN_PROGRESS") {
    await prisma.printJob.update({
      where: { id: dispatch.printJobId },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
  }
  await writeJobAudit(
    dispatch.printJobId,
    "JOB_STARTED",
    `Druck auf ${dispatch.machine.name} manuell gestartet`,
    actorId
  );
  publish({ type: "job.changed", jobId: dispatch.printJobId });
  return updated;
}

/** Cancel an uploaded/running dispatch. */
export async function cancelDispatch(
  dispatchId: string,
  actorId: string | null
): Promise<unknown> {
  const dispatch = await prisma.printDispatch.findUnique({
    where: { id: dispatchId },
    include: { machine: true },
  });
  if (!dispatch) throw new DispatchError("Dispatch nicht gefunden", 404);
  if (["DONE", "CANCELLED", "FAILED"].includes(dispatch.status)) {
    throw new DispatchError("Dispatch ist bereits abgeschlossen", 409);
  }

  if (dispatch.providerRef) {
    try {
      await getProvider(dispatch.machine).cancel(dispatch.providerRef);
    } catch {
      // Best effort — cancel the local record even if the printer is unreachable.
    }
  }
  const updated = await prisma.printDispatch.update({
    where: { id: dispatchId },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  await writeJobAudit(
    dispatch.printJobId,
    "JOB_DISPATCH_CANCELLED",
    `Dispatch auf ${dispatch.machine.name} abgebrochen`,
    actorId
  );
  publish({ type: "job.changed", jobId: dispatch.printJobId });
  return updated;
}

/**
 * Bulk-refresh in-flight dispatches from their printers and advance state:
 * STARTED → PRINTING when the printer reports it is printing, and → DONE when it
 * reports FINISHED. A DONE dispatch moves its job to AWAITING_VERIFICATION.
 * Also refreshes each connected machine's cached state. Mirrors the shape of
 * runJobAutoTransition() (audit written with userId: null).
 */
export async function refreshDispatches(): Promise<{
  refreshed: number;
  advanced: number;
}> {
  const active = await prisma.printDispatch.findMany({
    where: { status: { in: ["STARTED", "PRINTING"] } },
    include: { machine: true },
  });

  // Query each machine once, reuse for all its dispatches.
  const statusByMachine = new Map<string, PrinterStatus | null>();
  let advanced = 0;

  for (const dispatch of active) {
    if (!isConnected(dispatch.machine)) continue;
    let status = statusByMachine.get(dispatch.machineId);
    if (status === undefined) {
      try {
        status = await getProvider(dispatch.machine).getPrinterStatus();
        await prisma.machine.update({
          where: { id: dispatch.machineId },
          data: { lastSeenState: status.state, lastSeenAt: new Date() },
        });
      } catch {
        status = null;
      }
      statusByMachine.set(dispatch.machineId, status);
    }
    if (!status) continue;

    if (status.state === "PRINTING" && dispatch.status !== "PRINTING") {
      await prisma.printDispatch.update({
        where: { id: dispatch.id },
        data: { status: "PRINTING" },
      });
      publish({ type: "job.changed", jobId: dispatch.printJobId });
      advanced++;
    } else if (status.state === "FINISHED" || status.state === "IDLE") {
      // The print completed. Close the dispatch and hand the job to verification.
      await prisma.printDispatch.update({
        where: { id: dispatch.id },
        data: { status: "DONE", finishedAt: new Date() },
      });
      const job = await prisma.printJob.findUnique({
        where: { id: dispatch.printJobId },
        select: { status: true },
      });
      if (job && job.status === "IN_PROGRESS") {
        await prisma.printJob.update({
          where: { id: dispatch.printJobId },
          data: { status: "AWAITING_VERIFICATION" },
        });
        await writeJobAudit(
          dispatch.printJobId,
          "JOB_AWAITING_VERIFICATION",
          `Druck auf ${dispatch.machine.name} abgeschlossen`,
          null
        );
      }
      publish({ type: "job.changed", jobId: dispatch.printJobId });
      advanced++;
    }
  }

  return { refreshed: active.length, advanced };
}

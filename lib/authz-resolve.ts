// Entity id → order id lookups for the authz guards.
//
// Many order-scoped routes are addressed by the id of something that *belongs*
// to an order (a quote, an invoice, a part, a note). The guard needs the order,
// so each helper does the one `select: { orderId: true }` hop. Kept out of
// lib/authz.ts so that file stays about policy, not schema navigation.
//
// All return null when the entity does not exist; callers turn that into a 404.

import { prisma } from "@/lib/db";

export async function orderIdOfPart(partId: string): Promise<string | null> {
  const part = await prisma.orderPart.findUnique({
    where: { id: partId },
    select: { orderId: true },
  });
  return part?.orderId ?? null;
}

export async function orderIdOfFile(fileId: string): Promise<string | null> {
  const file = await prisma.orderFile.findUnique({
    where: { id: fileId },
    select: { orderId: true },
  });
  return file?.orderId ?? null;
}

export async function orderIdOfFileNote(noteId: string): Promise<string | null> {
  const note = await prisma.orderFileNote.findUnique({
    where: { id: noteId },
    select: { orderFile: { select: { orderId: true } } },
  });
  return note?.orderFile.orderId ?? null;
}

export async function orderIdOfQuote(quoteId: string): Promise<string | null> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { orderId: true },
  });
  return quote?.orderId ?? null;
}

export async function orderIdOfInvoice(invoiceId: string): Promise<string | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { orderId: true },
  });
  return invoice?.orderId ?? null;
}

/** Milestones and sprints hang off an order XOR a project. */
export async function scopeOfMilestone(
  id: string,
): Promise<{ orderId: string | null; projectId: string | null } | null> {
  return prisma.milestone.findUnique({
    where: { id },
    select: { orderId: true, projectId: true },
  });
}

export async function scopeOfMilestoneTask(
  taskId: string,
): Promise<{ orderId: string | null; projectId: string | null } | null> {
  const task = await prisma.milestoneTask.findUnique({
    where: { id: taskId },
    select: { milestone: { select: { orderId: true, projectId: true } } },
  });
  return task?.milestone ?? null;
}

export async function scopeOfSprint(
  id: string,
): Promise<{ orderId: string | null; projectId: string | null } | null> {
  return prisma.sprint.findUnique({
    where: { id },
    select: { orderId: true, projectId: true },
  });
}

/**
 * Every order a print job touches, via its parts.
 * A job is n:m with orders — see assertJobAccess in lib/authz.ts for why that
 * needs "all of them", not "any of them".
 */
export async function orderIdsOfJob(jobId: string): Promise<string[]> {
  const parts = await prisma.printJobPart.findMany({
    where: { printJobId: jobId },
    select: { orderPart: { select: { orderId: true } } },
  });
  return [...new Set(parts.map((p) => p.orderPart.orderId))];
}

export async function orderIdsOfParts(partIds: string[]): Promise<string[]> {
  const parts = await prisma.orderPart.findMany({
    where: { id: { in: partIds } },
    select: { orderId: true },
  });
  return [...new Set(parts.map((p) => p.orderId))];
}

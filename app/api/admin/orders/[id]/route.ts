import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { rm } from "fs/promises";
import path from "path";
import { getUploadDir } from "@/lib/uploads";
import { sendPhaseChangeEmail, sendSurveyEmail, sendVerificationEmail } from "@/lib/email";
import { getSetting } from "@/lib/settings";

const patchSchema = z.object({
  phaseId: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  archive: z.boolean().optional(),
  deadline: z.string().datetime().nullable().optional(),
  priceEstimate: z.number().nonnegative().nullable().optional(),
  isPrototype: z.boolean().optional(),
  iterationCount: z.number().int().min(1).optional(),
  isInternal: z.boolean().optional(),
  generalProject: z.boolean().optional(),
  estimatedCompletionAt: z.string().datetime().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      phase: true,
      assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      files: true,
      comments: {
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      auditLogs: {
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(order);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const current = await prisma.order.findUnique({
      where: { id },
      include: {
        phase: { select: { id: true, name: true, color: true, position: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
      },
    });


    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Block forward phase move if there's a pending verification
    if (data.phaseId && data.phaseId !== current.phaseId) {
      const targetPhaseForCheck = await prisma.orderPhase.findUnique({
        where: { id: data.phaseId },
        select: { position: true },
      });
      if (targetPhaseForCheck && targetPhaseForCheck.position > current.phase.position) {
        const pendingVerification = await prisma.verificationRequest.findFirst({
          where: { orderId: id, status: "PENDING" },
        });
        if (pendingVerification) {
          return NextResponse.json(
            { error: "Auftrag wartet auf Freigabe und kann nicht vorwärts verschoben werden" },
            { status: 409 }
          );
        }
      }
    }

    const userId = session.user?.id;

    // Sync assignees if provided
    if (data.assigneeIds !== undefined) {
      await prisma.orderAssignee.deleteMany({ where: { orderId: id } });
      if (data.assigneeIds.length > 0) {
        await prisma.orderAssignee.createMany({
          data: data.assigneeIds.map((userId) => ({ orderId: id, userId })),
        });
      }
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        ...(data.phaseId !== undefined ? { phaseId: data.phaseId } : {}),
        ...(data.archive !== undefined
          ? { archivedAt: data.archive ? new Date() : null }
          : {}),
        ...(data.deadline !== undefined
          ? { deadline: data.deadline ? new Date(data.deadline) : null }
          : {}),
        ...(data.priceEstimate !== undefined
          ? { priceEstimate: data.priceEstimate }
          : {}),
        ...(data.isPrototype !== undefined ? { isPrototype: data.isPrototype } : {}),
        ...(data.iterationCount !== undefined ? { iterationCount: data.iterationCount } : {}),
        ...(data.isInternal !== undefined ? { isInternal: data.isInternal } : {}),
        ...(data.generalProject !== undefined ? { generalProject: data.generalProject } : {}),
        ...(data.estimatedCompletionAt !== undefined
          ? { estimatedCompletionAt: data.estimatedCompletionAt ? new Date(data.estimatedCompletionAt) : null }
          : {}),
      },
      include: {
        phase: { select: { id: true, name: true, color: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    // Create audit logs
    if (data.phaseId && data.phaseId !== current.phaseId) {
      const newPhase = await prisma.orderPhase.findUnique({ where: { id: data.phaseId }, select: { name: true, isSurvey: true } });
      await prisma.auditLog.create({
        data: {
          orderId: id,
          userId: userId ?? null,
          action: "PHASE_CHANGED",
          details: `Phase geändert von "${current.phase.name}" zu "${newPhase?.name}"`,
        },
      });

      // Notify customer via email (non-blocking)
      if (newPhase) {
        sendPhaseChangeEmail({
          customerEmail: current.customerEmail,
          customerName: current.customerName,
          phaseName: newPhase.name,
          trackingToken: current.trackingToken,
        }).catch((err) => console.error("[email] Phase change notification failed:", err));

        // Trigger survey if new phase is a survey phase and surveys are enabled
        if (newPhase.isSurvey) {
          const surveyEnabled = await getSetting("survey_enabled");
          if (surveyEnabled === "true") {
            const existing = await prisma.surveyResponse.findUnique({ where: { orderId: id } });
            if (!existing) {
              const surveyResponse = await prisma.surveyResponse.create({
                data: { orderId: id },
              });
              await prisma.auditLog.create({
                data: {
                  orderId: id,
                  userId: userId ?? null,
                  action: "SURVEY_SENT",
                  details: "Umfrage per E-Mail versandt",
                },
              });
              sendSurveyEmail({
                customerEmail: current.customerEmail,
                customerName: current.customerName,
                surveyToken: surveyResponse.token,
              }).catch((err) => console.error("[email] Survey email failed:", err));
            }
          }
        }
      }
    }

    if (data.assigneeIds !== undefined) {
      const oldIds = new Set(current.assignees.map((a) => a.userId));
      const newIds = new Set(data.assigneeIds);
      const added = data.assigneeIds.filter((uid) => !oldIds.has(uid));
      const removed = [...oldIds].filter((uid) => !newIds.has(uid));

      if (added.length > 0 || removed.length > 0) {
        const addedUsers = await prisma.user.findMany({
          where: { id: { in: added } },
          select: { name: true },
        });
        const removedUsers = await prisma.user.findMany({
          where: { id: { in: removed } },
          select: { name: true },
        });

        const parts: string[] = [];
        if (addedUsers.length > 0) {
          parts.push(`Hinzugefügt: ${addedUsers.map((u) => u.name).join(", ")}`);
        }
        if (removedUsers.length > 0) {
          parts.push(`Entfernt: ${removedUsers.map((u) => u.name).join(", ")}`);
        }
        if (newIds.size === 0) {
          parts.length = 0;
          parts.push("Zuweisung entfernt");
        }

        await prisma.auditLog.create({
          data: {
            orderId: id,
            userId: userId ?? null,
            action: "ASSIGNED",
            details: parts.join("; "),
          },
        });
      }
    }

    if (data.archive !== undefined) {
      await prisma.auditLog.create({
        data: {
          orderId: id,
          userId: userId ?? null,
          action: data.archive ? "ORDER_ARCHIVED" : "ORDER_UNARCHIVED",
          details: data.archive ? "Auftrag archiviert" : "Auftrag aus Archiv wiederhergestellt",
        },
      });
    }

    if (data.deadline !== undefined) {
      const deadlineStr = data.deadline
        ? new Date(data.deadline).toLocaleDateString("de-DE")
        : "entfernt";
      await prisma.auditLog.create({
        data: {
          orderId: id,
          userId: userId ?? null,
          action: "DEADLINE_SET",
          details: `Deadline ${data.deadline ? `gesetzt auf ${deadlineStr}` : "entfernt"}`,
        },
      });
    }

    if (data.priceEstimate !== undefined) {
      await prisma.auditLog.create({
        data: {
          orderId: id,
          userId: userId ?? null,
          action: "PRICE_SET",
          details: data.priceEstimate != null
            ? `Angebot gesetzt auf ${data.priceEstimate.toFixed(2)} €`
            : "Angebot entfernt",
        },
      });

      // Auto-trigger PRICE_APPROVAL when price set (non-null, changed from previous)
      if (!current.isPrototype) {
        const previousPrice = current.priceEstimate ? Number(current.priceEstimate) : null;
        if (data.priceEstimate !== null && data.priceEstimate !== previousPrice) {
          const designApproved = await prisma.verificationRequest.findFirst({
            where: { orderId: id, type: "DESIGN_REVIEW", status: "APPROVED" },
          });
          const pendingPrice = await prisma.verificationRequest.findFirst({
            where: { orderId: id, type: "PRICE_APPROVAL", status: "PENDING" },
          });
          if (designApproved && !pendingPrice) {
            const vr = await prisma.verificationRequest.create({
              data: { orderId: id, type: "PRICE_APPROVAL" },
            });
            await prisma.auditLog.create({
              data: {
                orderId: id,
                userId: userId ?? null,
                action: "VERIFICATION_SENT",
                details: "Angebotsfreigabe Anfrage automatisch versandt",
              },
            });
            sendVerificationEmail({
              customerEmail: current.customerEmail,
              customerName: current.customerName,
              verificationToken: vr.token,
              type: "PRICE_APPROVAL",
              trackingToken: current.trackingToken,
              priceEstimate: data.priceEstimate,
            }).catch((err) => console.error("[email] Verification email failed:", err));
          }
        }
      }
    }

    if (data.isPrototype !== undefined && data.isPrototype !== current.isPrototype) {
      await prisma.auditLog.create({
        data: {
          orderId: id,
          userId: userId ?? null,
          action: data.isPrototype ? "PROTOTYPE_ENABLED" : "PROTOTYPE_DISABLED",
          details: data.isPrototype ? "Prototyp-Modus aktiviert" : "Prototyp-Modus deaktiviert",
        },
      });
    }

    if (data.iterationCount !== undefined && data.iterationCount !== current.iterationCount) {
      await prisma.auditLog.create({
        data: {
          orderId: id,
          userId: userId ?? null,
          action: "ITERATION_INCREMENTED",
          details: `Iteration erhöht auf #${data.iterationCount}`,
        },
      });
    }

    if (data.estimatedCompletionAt !== undefined) {
      const dateStr = data.estimatedCompletionAt
        ? new Date(data.estimatedCompletionAt).toLocaleDateString("de-DE")
        : "entfernt";
      await prisma.auditLog.create({
        data: {
          orderId: id,
          userId: userId ?? null,
          action: "COMPLETION_DATE_SET",
          details: `Geplantes Fertigstellungsdatum ${data.estimatedCompletionAt ? `gesetzt auf ${dateStr}` : "entfernt"}`,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Order update error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete from DB (cascades to files, comments, auditLogs)
  await prisma.order.delete({ where: { id } });

  // Delete files from filesystem
  const uploadDir = path.join(getUploadDir(), id);
  try {
    await rm(uploadDir, { recursive: true, force: true });
  } catch {
    // Non-critical: log but don't fail
    console.warn(`Could not delete upload directory: ${uploadDir}`);
  }

  return NextResponse.json({ success: true });
}

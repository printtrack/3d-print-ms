import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OrderDetail } from "@/components/admin/OrderDetail";
import { runJobAutoTransition } from "@/lib/jobs-auto-transition";
import { runInvoiceAutoTransition, runPaymentReminders } from "@/lib/invoice-auto-transition";
import { getReservedGramsByFilament } from "@/lib/filament-reservations";
import { TUTORIAL_ORDER_ID, TUTORIAL_ORDER_DETAIL, TUTORIAL_PARTS, TUTORIAL_PHASES, TUTORIAL_PART_PHASES, TUTORIAL_MACHINES, TUTORIAL_FILAMENT } from "@/lib/tutorial/sample-data";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

async function getData(id: string) {
  // Migrate orphan milestones into a default sprint so the RoadmapStrip can show them
  const orphanCount = await prisma.milestone.count({ where: { orderId: id, sprintId: null } });
  if (orphanCount > 0) {
    const existingSprintCount = await prisma.sprint.count({ where: { orderId: id } });
    if (existingSprintCount === 0) {
      const defaultSprint = await prisma.sprint.create({
        data: { orderId: id, name: "Allgemein", position: 0 },
        select: { id: true },
      });
      await prisma.milestone.updateMany({
        where: { orderId: id, sprintId: null },
        data: { sprintId: defaultSprint.id },
      });
    } else {
      // attach to first sprint
      const firstSprint = await prisma.sprint.findFirst({
        where: { orderId: id },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      if (firstSprint) {
        await prisma.milestone.updateMany({
          where: { orderId: id, sprintId: null },
          data: { sprintId: firstSprint.id },
        });
      }
    }
  }

  const [order, phases, teamMembers, orderParts, availableFilaments, partPhases, activeMachines, milestones, sprints] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        phase: true,
        project: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        files: {
          include: {
            notes: {
              include: { author: { select: { id: true, name: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
        },
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
        surveyResponse: {
          select: { token: true, sentAt: true, submittedAt: true, answers: true, comment: true },
        },
        verificationRequests: {
          select: { id: true, type: true, status: true, sentAt: true, resolvedAt: true, orderPartId: true, quoteId: true, rejectionReason: true },
          orderBy: { sentAt: "desc" },
        },
        quotes: {
          orderBy: { version: "desc" },
          include: { items: { orderBy: { position: "asc" } } },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          include: {
            items: { orderBy: { position: "asc" } },
            payments: { orderBy: { paidAt: "desc" } },
            reminders: { orderBy: { sentAt: "desc" } },
          },
        },
      },
    }),
    prisma.orderPhase.findMany({ orderBy: { position: "asc" } }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.orderPart.findMany({
      where: { orderId: id },
      include: {
        filament: {
          select: { id: true, name: true, material: true, color: true, colorHex: true, brand: true },
        },
        partPhase: { select: { id: true, name: true, color: true, isPrintReady: true, isReview: true, isPrinted: true, isMisprint: true } },
        files: {
          include: {
            notes: {
              include: { author: { select: { id: true, name: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        printJobParts: {
          include: { printJob: { select: { id: true, status: true, machine: { select: { name: true } } } } },
        },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.filament.findMany({
      where: { isActive: true },
      orderBy: [{ material: "asc" }, { name: "asc" }],
      select: { id: true, name: true, material: true, color: true, colorHex: true, brand: true, remainingGrams: true },
    }),
    prisma.partPhase.findMany({ orderBy: { position: "asc" } }),
    prisma.machine.findMany({
      where: { isActive: true },
      select: { id: true, name: true, buildVolumeX: true, buildVolumeY: true, buildVolumeZ: true },
      orderBy: { name: "asc" },
    }),
    prisma.milestone.findMany({
      where: { orderId: id },
      orderBy: { position: "asc" },
      include: {
        tasks: {
          include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
          orderBy: { position: "asc" },
        },
      },
    }),
    prisma.sprint.findMany({
      where: { orderId: id },
      orderBy: { position: "asc" },
      include: {
        milestones: {
          orderBy: { dueAt: "asc" },
          include: {
            tasks: { orderBy: { position: "asc" } },
          },
        },
      },
    }),
  ]);

  if (!order) return { order: null, phases, teamMembers, parts: [], availableFilaments: [], customerCredit: null, partPhases, activeMachines, milestones: [], sprints: [] };

  // Reservation-aware availability per filament
  const reservedByFilament = await getReservedGramsByFilament();
  const availableFilamentsWithStock = availableFilaments.map((f) => {
    const reserved = reservedByFilament.get(f.id) ?? 0;
    return { ...f, reservedGrams: reserved, availableGrams: f.remainingGrams - reserved };
  });

  // Look up customer credit by email
  const customerCreditRaw = await prisma.customer.findUnique({
    where: { email: order.customerEmail },
    select: { id: true, creditBalanceCents: true },
  });

  // Serialize dates to strings for client components
  const serialized = {
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    archivedAt: order.archivedAt ? order.archivedAt.toISOString() : null,
    deadline: order.deadline ? order.deadline.toISOString() : null,
    estimatedCompletionAt: order.estimatedCompletionAt ? order.estimatedCompletionAt.toISOString() : null,
    priceEstimate: order.priceEstimate ? Number(order.priceEstimate) : null,
    isPrototype: order.isPrototype,
    iterationCount: order.iterationCount,
    assignees: order.assignees.map((a) => a.user),
    files: order.files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      notes: f.notes.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
        resolvedAt: n.resolvedAt?.toISOString() ?? null,
      })),
    })),
    comments: order.comments.map((c) => ({
      id: c.id,
      content: c.content,
      sentToCustomer: c.sentToCustomer,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
    })),
    auditLogs: order.auditLogs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    surveyResponse: order.surveyResponse
      ? {
          ...order.surveyResponse,
          sentAt: order.surveyResponse.sentAt.toISOString(),
          submittedAt: order.surveyResponse.submittedAt
            ? order.surveyResponse.submittedAt.toISOString()
            : null,
          answers: order.surveyResponse.answers as Array<{ question: string; rating: number }> | null,
        }
      : null,
    verificationRequests: order.verificationRequests.map((vr) => ({
      id: vr.id,
      type: vr.type as "DESIGN_REVIEW" | "PRICE_APPROVAL",
      status: vr.status as "PENDING" | "APPROVED" | "REJECTED",
      sentAt: vr.sentAt.toISOString(),
      resolvedAt: vr.resolvedAt ? vr.resolvedAt.toISOString() : null,
      orderPartId: vr.orderPartId ?? null,
      quoteId: vr.quoteId ?? null,
      rejectionReason: vr.rejectionReason ?? null,
    })),
    quotes: order.quotes.map((q) => ({
      id: q.id,
      number: q.number ?? null,
      version: q.version,
      status: q.status as "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "EXPIRED" | "SUPERSEDED",
      totalCents: q.totalCents,
      taxCents: q.taxCents,
      validUntil: q.validUntil ? q.validUntil.toISOString() : null,
      sentAt: q.sentAt ? q.sentAt.toISOString() : null,
      approvedAt: q.approvedAt ? q.approvedAt.toISOString() : null,
      rejectedAt: q.rejectedAt ? q.rejectedAt.toISOString() : null,
      rejectionReason: q.rejectionReason ?? null,
      notes: q.notes ?? null,
      items: q.items.map((it) => ({
        id: it.id,
        description: it.description,
        quantity: Number(it.quantity),
        unitPriceCents: it.unitPriceCents,
        taxRatePercent: Number(it.taxRatePercent),
        category: it.category as "FILAMENT" | "HARDWARE" | "POST_PROCESSING" | "DESIGN" | "SHIPPING" | "DISCOUNT" | "OTHER",
        source: it.source as "ESTIMATE" | "FIXED" | "ACTUAL",
        orderPartId: it.orderPartId ?? null,
      })),
    })),
    invoices: order.invoices.map((inv) => ({
      id: inv.id,
      number: inv.number ?? null,
      status: inv.status as "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED",
      quoteId: inv.quoteId ?? null,
      reverseOfId: inv.reverseOfId ?? null,
      totalCents: inv.totalCents,
      taxCents: inv.taxCents,
      kleinunternehmer: inv.kleinunternehmer,
      issuedAt: inv.issuedAt ? inv.issuedAt.toISOString() : null,
      dueAt: inv.dueAt ? inv.dueAt.toISOString() : null,
      cancelledAt: inv.cancelledAt ? inv.cancelledAt.toISOString() : null,
      pdfPath: inv.pdfPath ?? null,
      notes: inv.notes ?? null,
      createdAt: inv.createdAt.toISOString(),
      items: inv.items.map((it) => ({
        id: it.id,
        description: it.description,
        quantity: Number(it.quantity),
        unitPriceCents: it.unitPriceCents,
        taxRatePercent: Number(it.taxRatePercent),
        category: it.category as "FILAMENT" | "HARDWARE" | "POST_PROCESSING" | "DESIGN" | "SHIPPING" | "DISCOUNT" | "OTHER",
        orderPartId: it.orderPartId ?? null,
      })),
      payments: inv.payments.map((p) => ({
        id: p.id,
        amountCents: p.amountCents,
        paidAt: p.paidAt.toISOString(),
        method: p.method as "SEPA" | "CASH" | "PAYPAL" | "CREDIT" | "CARD" | "OTHER",
        reference: p.reference ?? null,
        notes: p.notes ?? null,
      })),
      reminders: inv.reminders.map((r) => ({
        id: r.id,
        stage: r.stage,
        sentAt: r.sentAt.toISOString(),
        feeCents: r.feeCents ?? 0,
      })),
    })),
  };

  const serializedParts = orderParts.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    files: p.files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      notes: f.notes.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
        resolvedAt: n.resolvedAt?.toISOString() ?? null,
      })),
    })),
    printJobParts: p.printJobParts.map((pjp) => ({
      printJobId: pjp.printJobId,
      printJob: pjp.printJob,
    })),
  }));

  const customerCredit = customerCreditRaw
    ? { id: customerCreditRaw.id, balanceCents: customerCreditRaw.creditBalanceCents }
    : null;

  const serializedMilestones = milestones.map((m) => ({
    ...m,
    dueAt: m.dueAt ? m.dueAt.toISOString() : null,
    completedAt: m.completedAt ? m.completedAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    tasks: m.tasks.map((t) => ({
      ...t,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  }));

  const buildVolume = activeMachines.length > 0
    ? {
        x: Math.max(...activeMachines.map((m) => m.buildVolumeX ?? 0)),
        y: Math.max(...activeMachines.map((m) => m.buildVolumeY ?? 0)),
        z: Math.max(...activeMachines.map((m) => m.buildVolumeZ ?? 0)),
      }
    : undefined;

  const serializedSprints = sprints.map((sp) => ({
    id: sp.id,
    name: sp.name,
    position: sp.position,
    milestones: sp.milestones.map((m) => ({
      id: m.id,
      name: m.name,
      dueAt: m.dueAt ? m.dueAt.toISOString() : null,
      completedAt: m.completedAt ? m.completedAt.toISOString() : null,
      tasks: m.tasks.map((t) => ({ id: t.id, title: t.title, completed: t.completed })),
    })),
  }));

  return { order: serialized, phases, teamMembers, parts: serializedParts, availableFilaments: availableFilamentsWithStock, customerCredit, partPhases, activeMachines, buildVolume, milestones: serializedMilestones, sprints: serializedSprints };
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();

  // Tutorial order — serve mock data without DB access
  if (id === TUTORIAL_ORDER_ID) {
    const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";
    return (
      <OrderDetail
        order={TUTORIAL_ORDER_DETAIL}
        phases={TUTORIAL_PHASES}
        teamMembers={[]}
        currentUserId={session?.user?.id ?? ""}
        isAdmin={isAdmin}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parts={TUTORIAL_PARTS as any}
        availableFilaments={[{ ...TUTORIAL_FILAMENT, brand: TUTORIAL_FILAMENT.brand ?? null, reservedGrams: 0, availableGrams: TUTORIAL_FILAMENT.remainingGrams }]}
        customerCredit={null}
        partPhases={TUTORIAL_PART_PHASES}
        machines={TUTORIAL_MACHINES.map((m) => ({ id: m.id, name: m.name }))}
        buildVolume={{ x: 256, y: 256, z: 256 }}
        initialSprints={[]}
      />
    );
  }

  // Run before fetching so part phases + job links are current
  await runJobAutoTransition().catch(() => null);
  await runInvoiceAutoTransition().catch(() => null);
  await runPaymentReminders().catch(() => null);
  const { order, phases, teamMembers, parts, availableFilaments, customerCredit, partPhases, activeMachines, buildVolume, sprints } = await getData(id);

  if (!order) notFound();

  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";

  return (
    <OrderDetail
      order={order}
      phases={phases}
      teamMembers={teamMembers}
      currentUserId={session?.user?.id ?? ""}
      isAdmin={isAdmin}
      parts={parts}
      availableFilaments={availableFilaments}
      customerCredit={customerCredit}
      partPhases={partPhases}
      machines={activeMachines}
      buildVolume={buildVolume}
      initialSprints={sprints}
    />
  );
}

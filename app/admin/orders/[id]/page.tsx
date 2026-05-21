import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OrderDetail } from "@/components/admin/OrderDetail";
import { runJobAutoTransition } from "@/lib/jobs-auto-transition";
import { TUTORIAL_ORDER_ID, TUTORIAL_ORDER_DETAIL, TUTORIAL_PARTS, TUTORIAL_PHASES, TUTORIAL_PART_PHASES, TUTORIAL_MACHINES, TUTORIAL_FILAMENT } from "@/lib/tutorial/sample-data";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

async function getData(id: string) {
  const [order, phases, teamMembers, orderParts, availableFilaments, partPhases, activeMachines, milestones] = await Promise.all([
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
          select: { id: true, type: true, status: true, sentAt: true, resolvedAt: true, orderPartId: true, rejectionReason: true },
          orderBy: { sentAt: "desc" },
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
  ]);

  if (!order) return { order: null, phases, teamMembers, parts: [], availableFilaments: [], customerCredit: null, partPhases, activeMachines, milestones: [] };

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
      rejectionReason: vr.rejectionReason ?? null,
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

  return { order: serialized, phases, teamMembers, parts: serializedParts, availableFilaments, customerCredit, partPhases, activeMachines, buildVolume, milestones: serializedMilestones };
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
        availableFilaments={[{ ...TUTORIAL_FILAMENT, brand: TUTORIAL_FILAMENT.brand ?? null }]}
        customerCredit={null}
        partPhases={TUTORIAL_PART_PHASES}
        machines={TUTORIAL_MACHINES.map((m) => ({ id: m.id, name: m.name }))}
        buildVolume={{ x: 256, y: 256, z: 256 }}
        initialMilestones={[]}
      />
    );
  }

  // Run before fetching so part phases + job links are current
  await runJobAutoTransition().catch(() => null);
  const { order, phases, teamMembers, parts, availableFilaments, customerCredit, partPhases, activeMachines, buildVolume, milestones } = await getData(id);

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
      initialMilestones={milestones}
    />
  );
}

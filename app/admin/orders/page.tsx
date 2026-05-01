import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { DashboardView } from "@/components/admin/DashboardView";
import { FilterBar } from "@/components/admin/FilterBar";
import { HighlightHandler } from "@/components/admin/HighlightHandler";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function getData(
  search?: string,
  showArchived?: boolean,
  deadlineFilter?: string,
  assigneeIds?: string[],
  prototype?: boolean,
  internal?: boolean,
  pendingVerification?: boolean,
) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const andConditions = [
    ...(search
      ? [{
          OR: [
            { customerName: { contains: search } },
            { customerEmail: { contains: search } },
            { description: { contains: search } },
          ],
        }]
      : []),
    ...(deadlineFilter === "overdue" ? [{ deadline: { lt: now } }] : []),
    ...(deadlineFilter === "today" ? [{ deadline: { gte: startOfToday, lte: endOfToday } }] : []),
    ...(deadlineFilter === "week" ? [{ deadline: { gte: now, lte: endOfWeek } }] : []),
    ...(assigneeIds && assigneeIds.length > 0
      ? [{
          OR: [
            { assignees: { some: { userId: { in: assigneeIds } } } },
            { parts: { some: { assignees: { some: { userId: { in: assigneeIds } } } } } },
            { milestones: { some: { tasks: { some: { assignees: { some: { userId: { in: assigneeIds } } } } } } } },
          ],
        }]
      : []),
    ...(prototype ? [{ isPrototype: true }] : []),
    ...(internal ? [{ isInternal: true }] : []),
    ...(pendingVerification
      ? [{ verificationRequests: { some: { status: "PENDING" as const } } }]
      : []),
  ];

  const [phases, orders, archiveCount, users] = await Promise.all([
    showArchived
      ? Promise.resolve([])
      : prisma.orderPhase.findMany({ orderBy: { position: "asc" } }),
    prisma.order.findMany({
      where: {
        archivedAt: showArchived ? { not: null } : null,
        ...(andConditions.length > 0 ? { AND: andConditions } : {}),
      },
      include: {
        phase: { select: { id: true, name: true, color: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        files: { select: { id: true, filename: true, mimeType: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
        verificationRequests: { where: { status: "PENDING" }, select: { id: true } },
        milestones: {
          orderBy: { position: "asc" as const },
          select: {
            id: true, name: true, dueAt: true, completedAt: true, color: true, position: true,
            tasks: { select: { assignees: { select: { user: { select: { id: true, name: true } } } } } },
          },
        },
        parts: {
          select: { assignees: { include: { user: { select: { id: true, name: true } } } } },
        },
      },
      orderBy: [
        { phaseOrder: { sort: "asc", nulls: "last" } },
        { deadline: { sort: "asc", nulls: "last" } },
        { createdAt: "asc" },
      ],
    }),
    showArchived ? Promise.resolve(0) : prisma.order.count({ where: { archivedAt: { not: null } } }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedOrders = orders.map((o) => {
    const topAssignees = o.assignees.map((a) => a.user);
    const topAssigneeIds = new Set(topAssignees.map((u) => u.id));
    const partAssigneeUsers = o.parts.flatMap((p) => p.assignees.map((a) => a.user));
    const taskAssigneeUsers = o.milestones.flatMap((m) =>
      (m.tasks ?? []).flatMap((t) => t.assignees.map((a) => a.user))
    );
    const allAssigneeMap = new Map<string, { id: string; name: string }>();
    [...topAssignees, ...partAssigneeUsers, ...taskAssigneeUsers].forEach((u) =>
      allAssigneeMap.set(u.id, u)
    );

    return {
      ...o,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      archivedAt: o.archivedAt ? o.archivedAt.toISOString() : null,
      deadline: o.deadline ? o.deadline.toISOString() : null,
      priceEstimate: o.priceEstimate ? Number(o.priceEstimate) : null,
      assignees: topAssignees,
      allAssignees: [...allAssigneeMap.values()].map((u) => ({
        ...u,
        isTopLevel: topAssigneeIds.has(u.id),
      })),
      milestones: o.milestones.map((m) => ({
        ...m,
        dueAt: m.dueAt ? m.dueAt.toISOString() : null,
        completedAt: m.completedAt ? m.completedAt.toISOString() : null,
      })),
      pendingVerification: o.verificationRequests.length > 0,
      isPrototype: o.isPrototype,
      iterationCount: o.iterationCount,
      phaseOrder: o.phaseOrder,
    };
  });

  return { phases, orders: serializedOrders, archiveCount, users };
}

interface PageProps {
  searchParams: Promise<{
    search?: string;
    tab?: string;
    deadline?: string;
    highlight?: string;
    assigneeId?: string;
    prototype?: string;
    internal?: string;
    pendingVerification?: string;
  }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const { search, tab, deadline, highlight, assigneeId, prototype, internal, pendingVerification } =
    await searchParams;
  const showArchived = tab === "archiv";

  const assigneeIds = assigneeId?.split(",").filter(Boolean) ?? [];
  const isPrototype = prototype === "true";
  const isInternal = internal === "true";
  const isPendingVerification = pendingVerification === "true";

  const [session, { phases, orders, archiveCount, users }] = await Promise.all([
    auth(),
    getData(search, showArchived, deadline, assigneeIds, isPrototype, isInternal, isPendingVerification),
  ]);

  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";

  const filterKey = `${search || ""}-${deadline || ""}-${assigneeId || ""}-${prototype || ""}-${internal || ""}-${pendingVerification || ""}`;

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {showArchived ? "Archiv" : "Aufträge"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {orders.length} Auftrag{orders.length !== 1 ? "e" : ""}
            {search ? ` für "${search}"` : showArchived ? " archiviert" : " aktiv"}
          </p>
        </div>
        {!showArchived && (
          <Suspense>
            <FilterBar
              results={
                search && !showArchived
                  ? orders.map((o) => ({
                      id: o.id,
                      customerName: o.customerName,
                      customerEmail: o.customerEmail,
                      phase: { name: o.phase.name, color: o.phase.color },
                    }))
                  : []
              }
              users={users}
            />
          </Suspense>
        )}
      </div>

      {highlight && (
        <Suspense>
          <HighlightHandler orderId={highlight} />
        </Suspense>
      )}

      <DashboardView
        phases={phases}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orders={orders as any}
        archiveCount={archiveCount}
        showArchived={showArchived}
        isAdmin={isAdmin}
        searchQuery={search}
        filterKey={filterKey}
        users={users}
      />
    </div>
  );
}

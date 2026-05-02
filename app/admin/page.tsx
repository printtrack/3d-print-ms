import { prisma } from "@/lib/db";
import { DashboardHome } from "@/components/admin/DashboardHome";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const now = new Date();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const threshold48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [
    openOrdersCount,
    overdueOrdersCount,
    ordersThisWeek,
    activeJobsCount,
    overdueMilestonesCount,
    unslicedSoonCount,
    phasesWithCounts,
    recentActivityRaw,
  ] = await Promise.all([
    prisma.order.count({ where: { archivedAt: null } }),
    prisma.order.count({ where: { archivedAt: null, deadline: { lt: now } } }),
    prisma.order.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.printJob.count({ where: { status: { in: ["PLANNED", "IN_PROGRESS"] } } }),
    prisma.milestone.count({ where: { dueAt: { lt: now }, completedAt: null } }),
    prisma.printJob.count({ where: { status: "PLANNED", plannedAt: { not: null, lte: threshold48h } } }),
    prisma.orderPhase.findMany({
      orderBy: { position: "asc" },
      include: {
        _count: { select: { orders: { where: { archivedAt: null } } } },
      },
    }),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { customerName: true } },
        user: { select: { name: true } },
      },
    }),
  ]);

  const phaseBreakdown = phasesWithCounts.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    orderCount: p._count.orders,
  }));

  const recentActivity = recentActivityRaw.map((entry) => ({
    id: entry.id,
    action: entry.action,
    details: entry.details,
    createdAt: entry.createdAt.toISOString(),
    orderCustomerName: entry.order.customerName,
    orderId: entry.orderId,
    userName: entry.user?.name ?? null,
  }));

  return {
    openOrdersCount,
    overdueOrdersCount,
    ordersThisWeek,
    activeJobsCount,
    overdueMilestonesCount,
    unslicedSoonCount,
    phaseBreakdown,
    recentActivity,
  };
}

export default async function AdminDashboard() {
  const data = await getDashboardData();

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-auto">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Übersicht über laufende Aufträge und Aktivitäten</p>
      </div>
      <DashboardHome {...data} />
    </div>
  );
}

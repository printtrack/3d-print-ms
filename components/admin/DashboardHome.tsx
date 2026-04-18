"use client";

import Link from "next/link";
import { AlertTriangle, ClipboardList, Layers, TrendingUp, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days !== 1 ? "en" : ""}`;
}

interface PhaseCount {
  id: string;
  name: string;
  color: string;
  orderCount: number;
}

interface ActivityEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  orderCustomerName: string;
  orderId: string;
  userName: string | null;
}

interface DashboardHomeProps {
  openOrdersCount: number;
  overdueOrdersCount: number;
  activeJobsCount: number;
  ordersThisWeek: number;
  overdueMilestonesCount: number;
  phaseBreakdown: PhaseCount[];
  recentActivity: ActivityEntry[];
}

function MetricCard({
  title,
  value,
  href,
  icon: Icon,
  highlight,
}: {
  title: string;
  value: number;
  href: string;
  icon: React.ElementType;
  highlight?: "red" | "orange";
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon
            className={cn(
              "h-4 w-4",
              highlight === "red" && "text-destructive",
              highlight === "orange" && "text-orange-500",
              !highlight && "text-muted-foreground",
            )}
          />
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "text-3xl font-bold",
              highlight === "red" && "text-destructive",
              highlight === "orange" && "text-orange-500",
            )}
          >
            {value}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DashboardHome({
  openOrdersCount,
  overdueOrdersCount,
  activeJobsCount,
  ordersThisWeek,
  overdueMilestonesCount,
  phaseBreakdown,
  recentActivity,
}: DashboardHomeProps) {
  const maxPhaseCount = Math.max(...phaseBreakdown.map((p) => p.orderCount), 1);

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Offene Aufträge"
          value={openOrdersCount}
          href="/admin/orders"
          icon={ClipboardList}
        />
        <MetricCard
          title="Aktive Druckjobs"
          value={activeJobsCount}
          href="/admin/jobs"
          icon={Layers}
        />
        <MetricCard
          title="Überfällig"
          value={overdueOrdersCount}
          href="/admin/orders?deadline=overdue"
          icon={AlertTriangle}
          highlight={overdueOrdersCount > 0 ? "red" : undefined}
        />
        <MetricCard
          title="Neue Aufträge (Woche)"
          value={ordersThisWeek}
          href="/admin/orders"
          icon={TrendingUp}
        />
      </div>

      {/* Alert row */}
      {(overdueOrdersCount > 0 || overdueMilestonesCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdueOrdersCount > 0 && (
            <Link
              href="/admin/orders?deadline=overdue"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/15 transition-colors"
            >
              <AlertTriangle className="h-4 w-4" />
              {overdueOrdersCount}{" "}
              {overdueOrdersCount === 1 ? "überfälliger Auftrag" : "überfällige Aufträge"}
            </Link>
          )}
          {overdueMilestonesCount > 0 && (
            <Link
              href="/admin/planning"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-orange-500/10 text-orange-600 text-sm font-medium hover:bg-orange-500/15 transition-colors"
            >
              <AlertTriangle className="h-4 w-4" />
              {overdueMilestonesCount} offene{" "}
              {overdueMilestonesCount === 1 ? "Meilenstein" : "Meilensteine"} überfällig
            </Link>
          )}
        </div>
      )}

      {/* Bottom two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by phase */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aufträge nach Phase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {phaseBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine aktiven Aufträge</p>
            ) : (
              phaseBreakdown.map((phase) => (
                <div key={phase.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: phase.color }}
                      />
                      {phase.name}
                    </span>
                    <span className="text-muted-foreground font-medium">{phase.orderCount}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(phase.orderCount / maxPhaseCount) * 100}%`,
                        backgroundColor: phase.color,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Letzte Aktivität
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Aktivität</p>
            ) : (
              <ul className="space-y-3">
                {recentActivity.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="leading-snug">
                        <Link
                          href={`/admin/orders/${entry.orderId}`}
                          className="font-medium hover:underline"
                        >
                          {entry.orderCustomerName}
                        </Link>
                        <span className="text-muted-foreground"> · {entry.action}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entry.userName ?? "System"} · {timeAgo(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

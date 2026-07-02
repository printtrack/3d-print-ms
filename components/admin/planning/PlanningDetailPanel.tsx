"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Flag, Calendar, Package, AlertTriangle, ChevronRight, Info } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { parseYMD, dayDiff, type PlanEntry } from "@/lib/planning-entries";
import { cn, PhaseBadge, PlanAvatar, formatRel, useDateNames, type Translator } from "./shared";

interface Props {
  entry: PlanEntry | null;
  today: Date;
  onClose: () => void;
}

export function PlanningDetailPanel({ entry, today, onClose }: Props) {
  const t = useTranslations("admin") as unknown as Translator;
  const names = useDateNames();
  const e = entry;

  const kindMeta = (() => {
    if (!e) return { icon: <Package className="h-3 w-3" />, label: "", color: "text-muted-foreground" };
    if (e.kind === "milestone") return { icon: <Flag className="h-3 w-3" />, label: t("planning_milestone"), color: "text-[#7c3aed]" };
    if (e.kind === "event") return { icon: <Calendar className="h-3 w-3" />, label: t("planning_general_event"), color: "text-[color:var(--brand-accent-dim)]" };
    if (e.kind === "feed") return { icon: <Calendar className="h-3 w-3" />, label: t("planning_web_calendar"), color: "text-muted-foreground" };
    return { icon: <Package className="h-3 w-3" />, label: t("planning_deadline"), color: "text-[color:var(--brand-accent-dim)]" };
  })();

  const diff = e ? dayDiff(today, parseYMD(e.date)) : 0;

  return (
    <Sheet open={!!e} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-[380px]">
        {e && (
          <>
            <SheetHeader className="border-b p-4">
              <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide", kindMeta.color)}>
                {kindMeta.icon} {kindMeta.label}
              </span>
              <SheetTitle className="text-lg leading-tight tracking-tight">{e.title}</SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4">
              <div className={cn("mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground", e.overdue && "font-semibold text-[color:var(--destructive)]", e.done && "text-[#16a34a]")}>
                {e.overdue && <AlertTriangle className="h-3.5 w-3.5" />}
                {e.done ? t("planning_completed") : formatRel(diff, t)} · {names.fullDate(parseYMD(e.date))}
              </div>

              {e.kind === "milestone" && (
                <div className={cn("mb-4 rounded-lg border p-3", e.orderTitle ? "border-[#ddd6fe] bg-[oklch(0.98_0.015_300)]" : "bg-muted")}>
                  <span className={cn("mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wide", e.orderTitle ? "text-[#7c3aed]" : "text-muted-foreground")}>
                    {t("planning_belongs_to_order")}
                  </span>
                  {e.orderTitle ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.phase?.color ?? e.color }} />
                      <span className="text-[13.5px] font-semibold">{e.orderTitle}</span>
                      <span className="text-[12px] text-muted-foreground">· {e.customer}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[13.5px] font-semibold">{t("planning_internal_milestone")}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col overflow-hidden rounded-lg border">
                {e.kind !== "event" && e.kind !== "feed" && (
                  <Field label={t("planning_customer")} value={e.customer} />
                )}
                {e.kind === "feed" && <Field label={t("planning_web_calendar")} value={e.source ?? ""} />}
                {e.kind === "event" && e.note && <Field label={t("planning_note")} value={e.note} />}
                {(e.kind === "deadline" || e.kind === "event" || e.kind === "feed") && e.start !== e.end && (
                  <Field label={t("planning_period")} value={`${names.fullDate(parseYMD(e.start))} – ${names.fullDate(parseYMD(e.end))}`} />
                )}
                {e.email && <Field label={t("planning_email")} value={e.email} mono />}
                {e.phase && (
                  <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0">
                    <span className="text-[12px] text-muted-foreground">{t("planning_status")}</span>
                    <PhaseBadge name={e.phase.name} color={e.phase.color} />
                  </div>
                )}
              </div>

              {e.kind === "milestone" && e.tasksTotal > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("planning_tasks")} · {e.tasksDone}/{e.tasksTotal}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(e.tasksDone / e.tasksTotal) * 100}%`, background: e.done ? "#22c55e" : "var(--brand-accent)" }}
                    />
                  </div>
                </div>
              )}

              {e.assignees.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("planning_assignees")}</div>
                  <div className="flex flex-col gap-2">
                    {e.assignees.map((n) => (
                      <span key={n} className="flex items-center gap-2 text-[13px] font-medium">
                        <PlanAvatar name={n} /> {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <SheetFooter className="border-t p-4">
              {e.orderId ? (
                <Button asChild className="w-full">
                  <Link href={`/admin/orders/${e.orderId}`}>
                    {t("planning_open_order")} <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  {e.kind === "feed" ? t("planning_web_calendar") : e.kind === "event" ? t("planning_general_event") : t("planning_internal_appointment")}
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={cn("text-right text-[13px] font-medium", mono && "font-mono")}>{value}</span>
    </div>
  );
}

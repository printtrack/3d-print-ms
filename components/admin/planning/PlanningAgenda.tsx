"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Flag, Calendar, Package } from "lucide-react";
import { parseYMD, dayDiff, sameDay, type PlanEntry } from "@/lib/planning-entries";
import { cn, PhaseBadge, formatRel, useDateNames, type Translator } from "./shared";

interface Props {
  focus: Date;
  today: Date;
  entries: PlanEntry[];
  hideCust: boolean;
  onSelect: (e: PlanEntry) => void;
}

function kindIcon(kind: PlanEntry["kind"]) {
  if (kind === "milestone") return <Flag className="h-3.5 w-3.5" />;
  if (kind === "event") return <Calendar className="h-3.5 w-3.5" />;
  if (kind === "feed") return <Calendar className="h-3.5 w-3.5" />;
  return <Package className="h-3.5 w-3.5" />;
}

function AgendaRow({ e, today, hideCust, onSelect, t }: { e: PlanEntry; today: Date; hideCust: boolean; onSelect: (e: PlanEntry) => void; t: Translator }) {
  const diff = dayDiff(today, parseYMD(e.date));
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition hover:border-muted-foreground/40 hover:shadow-sm",
        e.done && "opacity-70"
      )}
      onClick={() => onSelect(e)}
    >
      <span className="self-stretch w-[3px] shrink-0 rounded-full" style={{ background: e.overdue ? "#ef4444" : e.color }} />
      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-muted text-muted-foreground">{kindIcon(e.kind)}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold">{e.title}</div>
        <div className="text-[12px] text-muted-foreground">
          {e.kind === "milestone" &&
            (e.orderTitle ? (
              <span>
                {t("planning_belongs_order")}: {e.orderTitle}
                {!hideCust ? ` · ${e.customer}` : ""}
              </span>
            ) : (
              <span className="italic">{t("planning_internal_milestone")}</span>
            ))}
          {e.kind === "deadline" && (
            <span>
              {!hideCust ? e.customer : ""}
              {e.owner && e.owner !== "Intern" && e.owner !== "Nicht zugewiesen" ? `${!hideCust ? " · " : ""}${e.owner}` : ""}
            </span>
          )}
          {e.kind === "event" && <span>{e.note || t("planning_general_event")}</span>}
          {e.kind === "feed" && <span>{e.source}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {e.kind === "milestone" ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11.5px] font-medium text-secondary-foreground">
            {e.done ? t("planning_done") : `${e.tasksDone}/${e.tasksTotal}`}
          </span>
        ) : e.kind === "event" ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11.5px] font-medium text-secondary-foreground">{t("planning_event")}</span>
        ) : e.kind === "feed" ? (
          <span className="rounded-full px-2 py-0.5 text-[11.5px] font-medium" style={{ background: `color-mix(in oklab, ${e.color} 14%, transparent)`, color: e.color }}>
            {e.source}
          </span>
        ) : (
          e.phase && <PhaseBadge name={e.phase.name} color={e.phase.color} />
        )}
        <span className={cn("min-w-[92px] text-right text-[12px] font-medium text-muted-foreground", e.overdue && "font-semibold text-[color:var(--destructive)]")}>
          {e.done ? t("planning_done") : formatRel(diff, t)}
        </span>
      </div>
    </button>
  );
}

export function PlanningAgenda({ focus, today, entries, hideCust, onSelect }: Props) {
  const t = useTranslations("admin") as unknown as Translator;
  const names = useDateNames();
  const month = focus.getMonth();
  const year = focus.getFullYear();
  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();
  const overdue = isCurrentMonth ? entries.filter((e) => e.overdue) : [];
  const inMonth = entries.filter((e) => {
    const d = parseYMD(e.date);
    return d.getMonth() === month && d.getFullYear() === year && !(isCurrentMonth && e.overdue);
  });
  const byDay: Record<string, PlanEntry[]> = {};
  for (const e of inMonth) (byDay[e.date] ||= []).push(e);
  const days = Object.keys(byDay).sort();

  if (overdue.length === 0 && days.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
        {t("planning_agenda_empty", { month: names.monthLong(month), year })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-1.5">
      {overdue.length > 0 && (
        <div className="rounded-lg bg-[color:var(--destructive)]/5 p-2">
          <div className="flex items-center gap-2 px-2.5 py-2 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--destructive)]">
            <AlertTriangle className="h-3.5 w-3.5" /> {t("planning_overdue")}
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{overdue.length}</span>
          </div>
          <div className="flex flex-col gap-1">
            {overdue
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((e) => (
                <AgendaRow key={e.id} e={e} today={today} hideCust={hideCust} onSelect={onSelect} t={t} />
              ))}
          </div>
        </div>
      )}
      {days.map((iso) => {
        const d = parseYMD(iso);
        const isToday = sameDay(d, today);
        const list = byDay[iso].sort((a, b) => (a.kind > b.kind ? 1 : -1));
        return (
          <div key={iso} className="p-2">
            <div className={cn("flex items-center gap-2 px-2.5 pt-1.5 pb-2 text-[12px] font-semibold text-muted-foreground", isToday && "text-[color:var(--brand-accent-dim)]")}>
              <span className="text-[13px] font-semibold text-foreground">{names.weekdayLong(d)}</span>
              <span className="font-medium text-muted-foreground">
                {d.getDate()}. {names.monthShort(d.getMonth())}
              </span>
              {isToday && <span className="rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold text-white" style={{ background: "var(--brand-accent)" }}>{t("planning_today")}</span>}
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{list.length}</span>
            </div>
            <div className="flex flex-col gap-1">
              {list.map((e) => (
                <AgendaRow key={e.id} e={e} today={today} hideCust={hideCust} onSelect={onSelect} t={t} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Calendar, Check, ChevronDown, Plus, Search, UserPlus, Users, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { localeToDateLocale, formatDate } from "@/lib/utils";

export interface HeaderTeamMember {
  id: string;
  name: string;
  email?: string;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Editable deadline chip — shown inline next to the title/phase chips.
 * Tone (red / amber / neutral) reflects how close the deadline is.
 */
export function DeadlineChip({
  deadline,
  onChange,
}: {
  deadline: string | null;
  onChange: (iso: string | null) => void | Promise<void>;
}) {
  const t = useTranslations("admin");
  const locale = localeToDateLocale(useLocale());
  const [open, setOpen] = useState(false);

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const days = useMemo(() => {
    if (!deadline || now === null) return null;
    return Math.ceil((new Date(deadline).getTime() - now) / (1000 * 60 * 60 * 24));
  }, [deadline, now]);

  const tone: "red" | "amber" | "neutral" =
    days === null ? "neutral" : days <= 3 ? "red" : days <= 7 ? "amber" : "neutral";

  const hasDeadline = !!deadline;

  const toneStyles = {
    neutral: {
      bg: "var(--secondary)",
      fg: "var(--secondary-foreground)",
      border: "var(--border)",
    },
    amber: {
      bg: "oklch(0.955 0.045 85)",
      fg: "oklch(0.42 0.12 55)",
      border: "oklch(0.42 0.12 55 / 0.25)",
    },
    red: {
      bg: "oklch(0.955 0.035 25)",
      fg: "oklch(0.52 0.2 27)",
      border: "oklch(0.52 0.2 27 / 0.25)",
    },
  }[tone];

  const isoDate = deadline ? new Date(deadline).toISOString().slice(0, 10) : "";

  const label = (() => {
    if (!hasDeadline) return t("order_header_no_deadline");
    if (days === null) return formatDate(deadline as string, locale);
    const prefix = days < 0 ? t("order_header_ago") : t("order_header_in");
    return `${prefix} ${Math.abs(days)} ${t("order_header_days_short")}`;
  })();

  const presets: Array<{ key: string; offset: number }> = [
    { key: "today", offset: 0 },
    { key: "tomorrow", offset: 1 },
    { key: "in3", offset: 3 },
    { key: "in1w", offset: 7 },
    { key: "in2w", offset: 14 },
  ];

  function setOffset(offset: number) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(12, 0, 0, 0);
    onChange(d.toISOString());
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="deadline-chip"
          title={
            deadline
              ? t("order_header_deadline_tooltip", { date: formatDate(deadline, locale) })
              : t("order_header_deadline_set_tooltip")
          }
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed px-2 py-0.5 text-[11.5px] font-medium leading-snug transition-[filter] hover:brightness-95"
          style={{
            background: toneStyles.bg,
            color: toneStyles.fg,
            borderColor: toneStyles.border,
          }}
        >
          <Calendar className="h-3 w-3" />
          {label}
          <ChevronDown className="h-2.5 w-2.5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-2">
        <div className="px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("order_header_set_deadline")}
        </div>
        <div className="flex flex-col gap-px">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setOffset(p.offset)}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
            >
              <Calendar className="h-3 w-3 opacity-55" />
              <span>{t(`order_header_preset_${p.key}` as const)}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 border-t pt-2">
          <label className="block px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("order_header_exact_date")}
          </label>
          <input
            type="date"
            defaultValue={isoDate}
            onChange={(e) => {
              if (!e.target.value) return;
              const d = new Date(e.target.value);
              d.setHours(12, 0, 0, 0);
              onChange(d.toISOString());
              setOpen(false);
            }}
            className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-[13px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {deadline && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {t("order_header_clear_deadline")}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Editable, overlapping avatar stack with a searchable assign/unassign popover.
 */
export function AssigneeStack({
  assigneeIds,
  team,
  onChange,
  max = 3,
}: {
  assigneeIds: string[];
  team: HeaderTeamMember[];
  onChange: (ids: string[]) => void | Promise<void>;
  max?: number;
}) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const assignees = team.filter((m) => assigneeIds.includes(m.id));
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;

  const filtered = team.filter((p) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.email?.toLowerCase().includes(q) ?? false);
  });
  const selectedFiltered = filtered.filter((p) => assigneeIds.includes(p.id));
  const unselectedFiltered = filtered.filter((p) => !assigneeIds.includes(p.id));

  function toggle(id: string) {
    const next = assigneeIds.includes(id)
      ? assigneeIds.filter((x) => x !== id)
      : [...assigneeIds, id];
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="assignee-stack"
          title={
            assignees.length
              ? t("order_header_assign_count", { count: assignees.length })
              : t("order_header_assign_tooltip")
          }
          className="group inline-flex items-center rounded-full border border-dashed border-border/80 bg-background py-[3px] pl-[3px] pr-1.5 transition-all hover:border-foreground/30 hover:bg-accent/40"
        >
          <span className="flex -space-x-1.5">
            {assignees.length === 0 && (
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted/60 text-muted-foreground ring-2 ring-background">
                <UserPlus className="h-3 w-3" />
              </span>
            )}
            {shown.map((p) => (
              <Avatar key={p.id} size="sm" className="ring-2 ring-background" title={p.name}>
                <AvatarFallback className="bg-primary/10 text-[9px] font-medium text-primary">
                  {getInitials(p.name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {extra > 0 && (
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-foreground/80 text-[9px] font-semibold text-background ring-2 ring-background">
                +{extra}
              </span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border/80 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12.5px] font-semibold tracking-tight">
              {assignees.length === 0
                ? t("order_header_assign_none")
                : t("order_header_assign_count", { count: assignees.length })}
            </span>
          </div>
          {assignees.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-muted-foreground transition-colors hover:text-destructive"
            >
              {t("order_header_assign_clear")}
            </button>
          )}
        </div>

        {team.length > 5 && (
          <div className="border-b border-border/60 px-2 py-1.5">
            <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
              <Search className="h-3 w-3 text-muted-foreground/60" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("order_header_assign_search")}
                className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
        )}

        <div className="max-h-72 overflow-y-auto py-1">
          {selectedFiltered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="group/row relative flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors hover:bg-accent"
            >
              <span className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-r-sm bg-primary/70" />
              <Avatar size="sm" className="ring-1 ring-primary/20">
                <AvatarFallback className="bg-primary/15 text-[9px] font-medium text-primary">
                  {getInitials(p.name)}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[12.5px] font-medium">{p.name}</span>
                {p.email && (
                  <span className="truncate text-[10.5px] text-muted-foreground">{p.email}</span>
                )}
              </span>
              <Check className="h-3.5 w-3.5 text-primary group-hover/row:hidden" />
              <span className="hidden h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary group-hover/row:flex">
                <X className="h-3 w-3" />
              </span>
            </button>
          ))}

          {selectedFiltered.length > 0 && unselectedFiltered.length > 0 && (
            <div className="mx-2.5 my-1 border-t border-border/40" />
          )}

          {unselectedFiltered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors hover:bg-accent"
            >
              <Avatar size="sm" className="opacity-80">
                <AvatarFallback className="bg-muted text-[9px] font-medium text-muted-foreground">
                  {getInitials(p.name)}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[12.5px] text-foreground/90">{p.name}</span>
                {p.email && (
                  <span className="truncate text-[10.5px] text-muted-foreground/80">{p.email}</span>
                )}
              </span>
              <Plus className="h-3.5 w-3.5 text-muted-foreground/40" />
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center">
              <Users className="mx-auto h-5 w-5 text-muted-foreground/30" />
              <p className="mt-2 text-[12px] text-muted-foreground">
                {query
                  ? t("order_header_assign_no_results", { query })
                  : t("order_header_no_team")}
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

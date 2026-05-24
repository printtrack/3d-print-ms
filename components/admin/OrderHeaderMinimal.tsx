"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import {
  Archive,
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  FlaskConical,
  Link as LinkIcon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn, localeToDateLocale, formatDate } from "@/lib/utils";

interface Phase {
  id: string;
  name: string;
  color: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface OrderHeaderMinimalProps {
  orderId: string;
  trackingToken: string;
  customerName: string;
  customerEmail: string;
  deadline: string | null;
  isPrototype: boolean;
  iterationCount: number;
  currentPhaseIsPrototype: boolean;
  onTogglePrototype: () => void | Promise<void>;
  togglingPrototype: boolean;
  phases: Phase[];
  selectedPhaseId: string;
  onPhaseChange: (phaseId: string) => void | Promise<void>;
  onDeadlineChange: (iso: string | null) => void | Promise<void>;
  assigneeIds: string[];
  onAssigneesChange: (ids: string[]) => void | Promise<void>;
  teamMembers: TeamMember[];
  isArchived: boolean;
  archiving: boolean;
  onToggleArchive: () => void | Promise<void>;
  isAdmin: boolean;
  deleting: boolean;
  onDelete: () => void | Promise<void>;
  savingPhase?: boolean;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function CopyableId({ id }: { id: string }) {
  const t = useTranslations("admin");
  const [copied, setCopied] = useState(false);
  const short = "#" + id.slice(-6).toUpperCase();
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(short);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
        toast.success(t("order_header_id_copied", { id: short }));
      }}
      title={t("order_header_id_tooltip", { id: short })}
      className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <span>{short}</span>
      {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5 opacity-60" />}
    </button>
  );
}

function PhaseChip({
  phases,
  value,
  onChange,
}: {
  phases: Phase[];
  value: string;
  onChange: (id: string) => void | Promise<void>;
}) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const current = phases.find((p) => p.id === value) ?? phases[0];
  if (!current) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="phase-chip"
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-[filter] hover:brightness-95"
          style={{
            borderColor: current.color + "33",
            background: current.color + "16",
            color: current.color,
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: current.color }}
          />
          {current.name}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("order_header_change_phase")}
        </div>
        <div className="flex flex-col gap-px">
          {phases.map((p) => {
            const active = p.id === value;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent",
                  active && "bg-accent font-medium"
                )}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: p.color }}
                />
                <span className="flex-1 truncate">{p.name}</span>
                {active && <Check className="h-3.5 w-3.5 opacity-60" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DeadlineChip({
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

function AssigneeStack({
  assigneeIds,
  team,
  onChange,
  max = 3,
}: {
  assigneeIds: string[];
  team: TeamMember[];
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
    return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
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
              <Avatar
                key={p.id}
                size="sm"
                className="ring-2 ring-background"
                title={p.name}
              >
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
                <span className="truncate text-[10.5px] text-muted-foreground">
                  {p.email}
                </span>
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
                <span className="truncate text-[12.5px] text-foreground/90">
                  {p.name}
                </span>
                <span className="truncate text-[10.5px] text-muted-foreground/80">
                  {p.email}
                </span>
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

function PrototypeChip({
  isPrototype,
  iterationCount,
  onToggle,
  toggling,
}: {
  isPrototype: boolean;
  iterationCount: number;
  onToggle: () => void | Promise<void>;
  toggling: boolean;
}) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);

  if (!isPrototype) {
    return (
      <button
        type="button"
        data-testid="prototype-chip"
        onClick={() => onToggle()}
        disabled={toggling}
        title={t("order_header_prototype_activate")}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-purple-300/60 bg-transparent px-2 py-0.5 text-[11.5px] font-medium text-purple-600/70 transition-colors hover:bg-purple-50 hover:text-purple-700 disabled:opacity-50"
      >
        <FlaskConical className="h-3 w-3" />
        <span>{t("order_header_prototype_label")}</span>
        <Plus className="h-2.5 w-2.5 opacity-60" />
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="prototype-chip"
          className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-purple-300/60 bg-gradient-to-br from-purple-50 to-purple-100/70 px-2.5 py-0.5 text-[12px] font-medium text-purple-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-[filter] hover:brightness-[0.97]"
        >
          <FlaskConical className="h-3 w-3 text-purple-600" />
          <span className="tracking-tight">{t("order_header_prototype_label")}</span>
          <span className="rounded bg-purple-200/60 px-1 py-px font-mono text-[10px] font-semibold tabular-nums text-purple-800">
            v{iterationCount}
          </span>
          <ChevronDown className="h-2.5 w-2.5 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 overflow-hidden p-0">
        <div className="flex items-center gap-2.5 border-b border-purple-100 bg-gradient-to-br from-purple-50/80 to-transparent px-3 py-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-100 text-purple-600">
            <FlaskConical className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold text-purple-900">
              {t("order_detail_prototype_mode")}
            </div>
            <div className="text-[11px] text-purple-700/70">
              {t("order_detail_iteration")}{iterationCount}
            </div>
          </div>
        </div>
        <div className="p-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onToggle();
            }}
            disabled={toggling}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-accent disabled:opacity-50"
          >
            <span>{t("order_header_prototype_deactivate")}</span>
            <X className="h-3.5 w-3.5 opacity-50" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function HeaderOverflowMenu({
  isArchived,
  archiving,
  onToggleArchive,
  isAdmin,
  deleting,
  onDelete,
  customerName,
}: {
  isArchived: boolean;
  archiving: boolean;
  onToggleArchive: () => void | Promise<void>;
  isAdmin: boolean;
  deleting: boolean;
  onDelete: () => void | Promise<void>;
  customerName: string;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" data-testid="order-overflow-menu">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onToggleArchive();
          }}
          disabled={archiving}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent disabled:opacity-50"
        >
          {isArchived ? (
            <>
              <RotateCcw className="h-3.5 w-3.5" />
              {archiving ? t("order_detail_restoring") : t("order_detail_restore")}
            </>
          ) : (
            <>
              <Archive className="h-3.5 w-3.5" />
              {archiving ? t("order_detail_archiving") : t("order_detail_archive")}
            </>
          )}
        </button>
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={deleting}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? t("order_detail_deleting") : t("order_detail_delete")}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("order_detail_delete_confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("order_detail_delete_confirm_desc", { name: customerName })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setOpen(false);
                    onDelete();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("order_detail_delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function OrderHeaderMinimal({
  orderId,
  trackingToken,
  customerName,
  customerEmail,
  deadline,
  isPrototype,
  iterationCount,
  currentPhaseIsPrototype,
  onTogglePrototype,
  togglingPrototype,
  phases,
  selectedPhaseId,
  onPhaseChange,
  onDeadlineChange,
  assigneeIds,
  onAssigneesChange,
  teamMembers,
  isArchived,
  archiving,
  onToggleArchive,
  isAdmin,
  deleting,
  onDelete,
}: OrderHeaderMinimalProps) {
  const t = useTranslations("admin");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Walk up the DOM from the sentinel to find the scrolling ancestor.
    let el: HTMLElement | null = sentinelRef.current;
    let container: HTMLElement | null = null;
    while (el) {
      const styles = window.getComputedStyle(el);
      const overflowY = styles.overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        container = el;
        break;
      }
      el = el.parentElement;
    }
    if (!container) container = document.documentElement;

    // Two-threshold hysteresis: prevent oscillation at the boundary.
    // Pin when scrolled past 80px, unpin only when scrolled back above 20px.
    let isScrolled = false;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = container!.scrollTop;
      if (!isScrolled && y > 80) {
        isScrolled = true;
        setScrolled(true);
      } else if (isScrolled && y < 20) {
        isScrolled = false;
        setScrolled(false);
      }
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      container?.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  function copyTrackingLink() {
    const url = `${window.location.origin}/track/${trackingToken}`;
    navigator.clipboard?.writeText(url);
    toast.success(t("order_header_tracking_copied"));
  }

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      <div
        data-scrolled={scrolled ? "true" : "false"}
        className={cn(
          "sticky z-30 -mx-6 -mt-6 border-b border-transparent bg-background",
          scrolled && "border-border shadow-[0_6px_14px_-8px_rgba(0,0,0,0.08)]"
        )}
        style={{ top: -24 }}
      >
        <div
          className="mx-auto max-w-5xl px-6"
          style={{
            paddingTop: scrolled ? 10 : 16,
            paddingBottom: scrolled ? 10 : 14,
          }}
        >
          {!scrolled && (
            <div className="mb-2.5 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <Link
                href="/admin/orders"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>{t("order_detail_back")}</span>
              </Link>
              <span className="opacity-40">/</span>
              <CopyableId id={orderId} />
            </div>
          )}

          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <Avatar size={scrolled ? "default" : "lg"}>
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(customerName)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h1
                  className="m-0 truncate font-bold leading-tight tracking-tight"
                  style={{ fontSize: scrolled ? 16 : 20 }}
                >
                  {customerName}
                </h1>
                <PhaseChip
                  phases={phases}
                  value={selectedPhaseId}
                  onChange={onPhaseChange}
                />
                <DeadlineChip deadline={deadline} onChange={onDeadlineChange} />
                {currentPhaseIsPrototype && (
                  <PrototypeChip
                    isPrototype={isPrototype}
                    iterationCount={iterationCount}
                    onToggle={onTogglePrototype}
                    toggling={togglingPrototype}
                  />
                )}
              </div>
              {!scrolled && (
                <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                  <a
                    href={`mailto:${customerEmail}`}
                    className="hover:text-foreground"
                  >
                    {customerEmail}
                  </a>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <AssigneeStack
                assigneeIds={assigneeIds}
                team={teamMembers}
                onChange={onAssigneesChange}
              />
              {!scrolled && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={copyTrackingLink}
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  {t("order_header_tracking")}
                </Button>
              )}
              <HeaderOverflowMenu
                isArchived={isArchived}
                archiving={archiving}
                onToggleArchive={onToggleArchive}
                isAdmin={isAdmin}
                deleting={deleting}
                onDelete={onDelete}
                customerName={customerName}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

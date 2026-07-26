"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ATTENDANCE_ENABLED_KEY,
  ATTENDANCE_WINDOWS_KEY,
  DEFAULT_ATTENDANCE_WINDOWS,
  formatTime,
  parseTime,
  parseWindows,
  type AttendanceWindow,
} from "@/lib/attendance";

const DAY_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
/** Monday first — how a European week is read. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface DayRow {
  day: number;
  active: boolean;
  start: string;
  end: string;
}

function toRows(windows: AttendanceWindow[]): DayRow[] {
  return DAY_ORDER.map((day) => {
    const w = windows.find((x) => x.day === day);
    return {
      day,
      active: Boolean(w),
      start: w ? formatTime(w.startMinutes) : "08:00",
      end: w ? formatTime(w.endMinutes) : "18:00",
    };
  });
}

/**
 * When staff is on site. Printers run around the clock; loading a plate, swapping
 * filament and taking a finished print off can only happen inside these hours —
 * the scheduler plans accordingly.
 */
export function AttendanceSettings({
  initialSettings,
}: {
  initialSettings: Record<string, string>;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [enabled, setEnabled] = useState(initialSettings[ATTENDANCE_ENABLED_KEY] === "true");
  const [rows, setRows] = useState<DayRow[]>(() =>
    toRows(
      initialSettings[ATTENDANCE_WINDOWS_KEY]
        ? parseWindows(initialSettings[ATTENDANCE_WINDOWS_KEY])
        : DEFAULT_ATTENDANCE_WINDOWS
    )
  );
  const [saving, setSaving] = useState(false);

  function updateRow(day: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((r) => (r.day === day ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    const windows: AttendanceWindow[] = [];
    for (const row of rows) {
      if (!row.active) continue;
      const startMinutes = parseTime(row.start);
      const endMinutes = parseTime(row.end);
      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        toast.error(t("attendance_invalid_row", { day: DAY_LABELS[row.day] }));
        return;
      }
      windows.push({ day: row.day, startMinutes, endMinutes });
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [ATTENDANCE_ENABLED_KEY]: enabled ? "true" : "false",
          [ATTENDANCE_WINDOWS_KEY]: JSON.stringify(windows),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("attendance_saved"));
    } catch {
      toast.error(t("attendance_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("attendance_title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("attendance_desc")}</p>
      </div>

      <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer">
        <Checkbox
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
          data-testid="attendance-enabled"
          className="mt-0.5"
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium">{t("attendance_enable_label")}</span>
          <span className="block text-xs text-muted-foreground">{t("attendance_enable_hint")}</span>
        </span>
      </label>

      <div className="space-y-2">
        <Label>{t("attendance_week")}</Label>
        <div className="rounded-lg border divide-y" data-testid="attendance-week">
          {rows.map((row) => (
            <div key={row.day} className="flex items-center gap-3 px-4 py-2.5">
              <Checkbox
                checked={row.active}
                onCheckedChange={(v) => updateRow(row.day, { active: v === true })}
                aria-label={DAY_LABELS[row.day]}
              />
              <span className="w-8 text-sm font-medium">{DAY_LABELS[row.day]}</span>
              <Input
                type="time"
                className="h-8 w-28"
                value={row.start}
                disabled={!row.active}
                aria-label={`${DAY_LABELS[row.day]} ${t("attendance_from")}`}
                onChange={(e) => updateRow(row.day, { start: e.target.value })}
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                type="time"
                className="h-8 w-28"
                value={row.end}
                disabled={!row.active}
                aria-label={`${DAY_LABELS[row.day]} ${t("attendance_to")}`}
                onChange={(e) => updateRow(row.day, { end: e.target.value })}
              />
              {!row.active && (
                <span className="text-xs text-muted-foreground">{t("attendance_nobody")}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} data-testid="attendance-save">
        {saving ? tc("saving") : tc("save")}
      </Button>
    </div>
  );
}

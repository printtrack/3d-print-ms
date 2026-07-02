"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ymd, type PlanningCalendarEvent } from "@/lib/planning-entries";
import type { PlanningUser } from "@/components/admin/PlanningView";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: PlanningUser[];
  today: Date;
  onCreated: (event: PlanningCalendarEvent) => void;
}

const NO_OWNER = "__none__";

export function PlanningCreateEventDialog({ open, onOpenChange, users, today, onCreated }: Props) {
  const t = useTranslations("admin");
  const todayStr = ymd(today);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [ownerId, setOwnerId] = useState<string>(NO_OWNER);
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState(todayStr);
  const [end, setEnd] = useState(todayStr);
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle("");
    setNote("");
    setOwnerId(NO_OWNER);
    setAllDay(true);
    setStart(todayStr);
    setEnd(todayStr);
  }

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    const endEff = allDay ? start : end < start ? start : end;
    try {
      const res = await fetch("/api/admin/calendar-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          note: note.trim() || null,
          ownerId: ownerId === NO_OWNER ? null : ownerId,
          allDay,
          startAt: start,
          endAt: endEff,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("planning_create_failed"));
      }
      const created = await res.json();
      onCreated({
        id: created.id,
        title: created.title,
        note: created.note ?? null,
        startAt: created.startAt,
        endAt: created.endAt,
        allDay: created.allDay,
        color: created.color,
        owner: created.owner ? { id: created.owner.id, name: created.owner.name } : null,
      });
      toast.success(t("planning_event_created"));
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("planning_create_failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <SheetContent className="w-full gap-0 p-0 sm:max-w-[380px]">
        <SheetHeader className="border-b p-4">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Calendar className="h-3 w-3" /> {t("planning_general_event")}
          </span>
          <SheetTitle className="sr-only">{t("planning_create_event")}</SheetTitle>
          <SheetDescription className="text-[12px] leading-relaxed">{t("planning_create_hint")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3.5">
            <Label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">{t("planning_field_title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("planning_field_title_ph")} autoFocus />
          </div>
          <div className="mb-3.5">
            <Label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
              {t("planning_field_note")} <span className="font-normal">({t("planning_optional")})</span>
            </Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("planning_field_note_ph")} />
          </div>
          <div className="mb-3.5">
            <Label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
              {t("planning_field_owner")} <span className="font-normal">({t("planning_optional")})</span>
            </Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_OWNER}>— {t("planning_nobody")} —</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full items-center justify-between gap-2 py-2">
            <span className="cursor-pointer text-[13px] font-medium" onClick={() => setAllDay((v) => !v)}>
              {t("planning_field_allday")}
            </span>
            <Switch checked={allDay} onCheckedChange={setAllDay} />
          </div>
          {allDay ? (
            <div className="mt-1.5">
              <Label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">{t("planning_field_date")}</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
          ) : (
            <div className="mt-1.5 flex gap-2.5">
              <div className="flex-1">
                <Label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">{t("planning_field_from")}</Label>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="flex-1">
                <Label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">{t("planning_field_to")}</Label>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 border-t p-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            {t("planning_cancel")}
          </Button>
          <Button className="flex-1" onClick={submit} disabled={!title.trim() || saving}>
            {t("planning_create_event")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

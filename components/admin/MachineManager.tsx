"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Cpu, Pencil, Plus, Trash2, ChevronDown, ChevronRight, Wrench, Printer, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { MachineDowntimeDialog } from "@/components/admin/MachineDowntimeDialog";
import { PRINTER_PROFILES } from "@/lib/printers/registry";
import { downtimeState } from "@/lib/machine-downtime";
import { useLocale } from "next-intl";
import { formatDateTime, localeToDateLocale } from "@/lib/utils";

interface Downtime {
  id: string;
  reason: "MAINTENANCE" | "DEFECT";
  note: string | null;
  startedAt: string;
  endedAt: string | null;
}

interface MachineConnection {
  type: string;
  profile: string | null;
  vendor: string | null;
  model: string | null;
  printerId: string | null;
  baseUrl: string | null;
  mockState: string | null;
  hasToken: boolean;
}

const VENDORS = [...new Set(PRINTER_PROFILES.map((p) => p.vendor))];

interface Machine {
  id: string;
  name: string;
  buildVolumeX: number;
  buildVolumeY: number;
  buildVolumeZ: number;
  hourlyRate: number | null;
  notes: string | null;
  isActive: boolean;
  connected?: boolean;
  connection?: MachineConnection;
  lastSeenState?: string | null;
  _count: { printJobs: number };
  downtimes: Downtime[];
}

type MachineStatus = "operational" | "down" | "scheduled";

function machineStatus(m: Machine): MachineStatus {
  const now = new Date();
  let scheduled = false;
  for (const d of m.downtimes ?? []) {
    const state = downtimeState(
      { startedAt: new Date(d.startedAt), endedAt: d.endedAt ? new Date(d.endedAt) : null },
      now
    );
    if (state === "ACTIVE") return "down";
    if (state === "SCHEDULED") scheduled = true;
  }
  return scheduled ? "scheduled" : "operational";
}

function activeDowntime(m: Machine): Downtime | null {
  const now = new Date();
  return (
    (m.downtimes ?? []).find(
      (d) =>
        downtimeState(
          { startedAt: new Date(d.startedAt), endedAt: d.endedAt ? new Date(d.endedAt) : null },
          now
        ) === "ACTIVE"
    ) ?? null
  );
}

type FormData = {
  name: string;
  buildVolumeX: string;
  buildVolumeY: string;
  buildVolumeZ: string;
  hourlyRate: string;
  notes: string;
  isActive: boolean;
  connVendor: string; // "none" | vendor name
  connProfile: string; // registry profile id or ""
  connToken: string;
  connPrinterId: string;
  connBaseUrl: string;
  connMockState: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  buildVolumeX: "",
  buildVolumeY: "",
  buildVolumeZ: "",
  hourlyRate: "",
  notes: "",
  isActive: true,
  connVendor: "none",
  connProfile: "",
  connToken: "",
  connPrinterId: "",
  connBaseUrl: "",
  connMockState: "IDLE",
};

export function MachineManager({ initialMachines }: { initialMachines: Machine[] }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateLocale = localeToDateLocale(locale);
  const [machines, setMachines] = useState<Machine[]>(
    initialMachines.map((m) => ({ ...m, downtimes: m.downtimes ?? [] }))
  );
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [downtimeMachine, setDowntimeMachine] = useState<Machine | null>(null);
  const [downtimeOpen, setDowntimeOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  function loadMachines() {
    return fetch("/api/admin/machines")
      .then((r) => r.json())
      .then((fresh: Machine[]) => setMachines(fresh.map((m) => ({ ...m, downtimes: m.downtimes ?? [] }))))
      .catch(() => {});
  }

  useEffect(() => {
    loadMachines();
  }, []);

  function openDowntime(machine: Machine) {
    setDowntimeMachine(machine);
    setDowntimeOpen(true);
  }

  async function markAvailable(machine: Machine) {
    const dt = activeDowntime(machine);
    if (!dt) return;
    try {
      const res = await fetch(`/api/admin/machines/${machine.id}/downtime/${dt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("machine_downtime_resolved"));
      loadMachines();
    } catch {
      toast.error(t("machine_downtime_failed"));
    }
  }

  async function deleteDowntime(machine: Machine, downtimeId: string) {
    if (!confirm(t("machine_downtime_delete_confirm"))) return;
    try {
      const res = await fetch(`/api/admin/machines/${machine.id}/downtime/${downtimeId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      loadMachines();
    } catch {
      toast.error(t("machine_downtime_failed"));
    }
  }

  function openCreate() {
    setFormData(EMPTY_FORM);
    setEditingMachine(null);
    setIsDialogOpen(true);
  }

  function openEdit(machine: Machine) {
    const conn = machine.connection;
    setFormData({
      name: machine.name,
      buildVolumeX: String(machine.buildVolumeX),
      buildVolumeY: String(machine.buildVolumeY),
      buildVolumeZ: String(machine.buildVolumeZ),
      hourlyRate: machine.hourlyRate != null ? String(machine.hourlyRate) : "",
      notes: machine.notes ?? "",
      isActive: machine.isActive,
      connVendor: conn?.vendor ?? "none",
      connProfile: conn?.profile ?? "",
      connToken: "", // never prefilled — blank keeps the stored token
      connPrinterId: conn?.printerId ?? "",
      connBaseUrl: conn?.baseUrl ?? "",
      connMockState: conn?.mockState ?? "IDLE",
    });
    setEditingMachine(machine);
    setIsDialogOpen(true);
  }

  // Selecting a vendor auto-picks its first model (or clears when "Keine").
  function selectVendor(vendor: string) {
    if (vendor === "none") {
      setFormData((prev) => ({ ...prev, connVendor: "none", connProfile: "" }));
      return;
    }
    const first = PRINTER_PROFILES.find((p) => p.vendor === vendor);
    setFormData((prev) => ({
      ...prev,
      connVendor: vendor,
      connProfile: first?.id ?? "",
    }));
  }

  const selectedProfile = PRINTER_PROFILES.find((p) => p.id === formData.connProfile) ?? null;

  function field(key: keyof FormData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function buildConnectionPayload() {
    if (formData.connVendor === "none" || !formData.connProfile) {
      return { profile: "none" as const };
    }
    const profile = PRINTER_PROFILES.find((p) => p.id === formData.connProfile);
    const isMock = profile?.transport === "mock";
    return {
      profile: formData.connProfile,
      token: formData.connToken, // blank = keep stored token (server-side)
      printerId: formData.connPrinterId.trim() || null,
      baseUrl: formData.connBaseUrl.trim() || null,
      mockState: isMock ? formData.connMockState : null,
    };
  }

  async function testConnection() {
    if (!editingMachine) return;
    setTesting(true);
    try {
      // Persist the current connection config first, so the test hits what the
      // operator just typed.
      const saveRes = await fetch(`/api/admin/machines/${editingMachine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection: buildConnectionPayload() }),
      });
      if (!saveRes.ok) throw new Error();
      const res = await fetch(`/api/admin/machines/${editingMachine.id}/test-connection`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        toast.success(t("machine_conn_test_ok", { state: data.status?.state ?? "" }));
        loadMachines();
      } else {
        toast.error(data.error || t("machine_conn_test_failed"));
      }
    } catch {
      toast.error(t("machine_conn_test_failed"));
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!formData.name.trim()) { toast.error(t("machine_name_required")); return; }
    if (!formData.buildVolumeX || !formData.buildVolumeY || !formData.buildVolumeZ) {
      toast.error(t("machine_volume_required"));
      return;
    }

    const payload = {
      name: formData.name.trim(),
      buildVolumeX: parseInt(formData.buildVolumeX, 10),
      buildVolumeY: parseInt(formData.buildVolumeY, 10),
      buildVolumeZ: parseInt(formData.buildVolumeZ, 10),
      hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
      notes: formData.notes.trim() || null,
      isActive: formData.isActive,
    };

    setSaving(true);
    try {
      if (editingMachine) {
        const editPayload = { ...payload, connection: buildConnectionPayload() };
        const res = await fetch(`/api/admin/machines/${editingMachine.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editPayload),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        setMachines((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        toast.success(t("machine_updated"));
      } else {
        const res = await fetch("/api/admin/machines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        setMachines((prev) => [...prev, { ...created, _count: { printJobs: 0 }, downtimes: created.downtimes ?? [] }]);
        toast.success(t("machine_created"));
      }
      setIsDialogOpen(false);
    } catch {
      toast.error(t("machine_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(machine: Machine) {
    if (!confirm(t("machine_delete_confirm", { name: machine.name }))) return;

    try {
      const res = await fetch(`/api/admin/machines/${machine.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error);
        return;
      }
      setMachines((prev) => prev.filter((m) => m.id !== machine.id));
      toast.success(t("machine_deleted"));
    } catch {
      toast.error(t("machine_delete_failed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("machine_title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("machine_desc")}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t("machine_add")}
        </Button>
      </div>

      <div className="space-y-2">
        {machines.map((machine) => {
          const status = machineStatus(machine);
          const dt = activeDowntime(machine);
          const statusColor =
            status === "down" ? "bg-destructive" : status === "scheduled" ? "bg-amber-500" : "bg-emerald-500";
          const statusLabel =
            status === "down"
              ? t("machine_status_down")
              : status === "scheduled"
                ? t("machine_status_scheduled")
                : t("machine_status_operational");
          const isExpanded = expanded[machine.id] ?? false;
          return (
            <div key={machine.id} className="bg-card border rounded-lg" data-testid="machine-row">
              <div className="flex items-center gap-3 p-3">
                <span
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusColor}`}
                  title={statusLabel}
                  data-testid="machine-status-dot"
                  data-status={status}
                />
                <Cpu className="h-5 w-5 text-muted-foreground shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{machine.name}</span>
                    {status === "down" && (
                      <Badge variant="destructive" className="text-xs">{statusLabel}</Badge>
                    )}
                    {status === "scheduled" && (
                      <Badge variant="secondary" className="text-xs">{statusLabel}</Badge>
                    )}
                    {!machine.isActive && (
                      <Badge variant="secondary" className="text-xs">{t("machine_badge_inactive")}</Badge>
                    )}
                    {machine.connected && (
                      <Badge
                        variant="outline"
                        className="text-xs gap-1"
                        data-testid="machine-conn-badge"
                      >
                        <Printer className="h-3 w-3" />
                        {machine.lastSeenState
                          ? t("machine_conn_badge_state", {
                              state: t(`printer_state_${machine.lastSeenState.toLowerCase()}`),
                            })
                          : t("machine_conn_badge_connected")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {machine.buildVolumeX} × {machine.buildVolumeY} × {machine.buildVolumeZ} mm
                    {machine.hourlyRate != null && ` · ${Number(machine.hourlyRate).toFixed(2)} €/h`}
                  </p>
                </div>

                <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">
                  {machine._count.printJobs} {t("machine_badge_jobs")}
                </span>

                <div className="flex gap-1">
                  {dt ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => markAvailable(machine)}
                      data-testid="machine-mark-available"
                    >
                      {t("machine_mark_available")}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openDowntime(machine)}
                      title={t("machine_report_outage")}
                      data-testid="machine-report-outage"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {machine.downtimes.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setExpanded((prev) => ({ ...prev, [machine.id]: !isExpanded }))}
                      title={t("machine_downtime_history")}
                      data-testid="machine-history-toggle"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(machine)}
                    data-testid="machine-edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(machine)}
                    data-testid="machine-delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {isExpanded && machine.downtimes.length > 0 && (
                <div className="border-t px-3 py-2 space-y-1.5" data-testid="machine-history">
                  <p className="text-xs font-medium text-muted-foreground">{t("machine_downtime_history")}</p>
                  {machine.downtimes.map((d) => {
                    const state = downtimeState(
                      { startedAt: new Date(d.startedAt), endedAt: d.endedAt ? new Date(d.endedAt) : null }
                    );
                    return (
                      <div key={d.id} className="flex items-center gap-2 text-xs" data-testid="downtime-row">
                        <Badge
                          variant={d.reason === "DEFECT" ? "destructive" : "secondary"}
                          className="text-[10px] shrink-0"
                        >
                          {d.reason === "DEFECT" ? t("machine_reason_defect") : t("machine_reason_maintenance")}
                        </Badge>
                        <span className="text-muted-foreground">
                          {formatDateTime(d.startedAt, dateLocale)}
                          {" – "}
                          {d.endedAt
                            ? formatDateTime(d.endedAt, dateLocale)
                            : state === "SCHEDULED"
                              ? t("machine_downtime_scheduled_tag")
                              : t("machine_downtime_ongoing")}
                        </span>
                        {d.note && <span className="text-muted-foreground truncate">· {d.note}</span>}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-auto text-destructive hover:text-destructive shrink-0"
                          onClick={() => deleteDowntime(machine, d.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {machines.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {t("machine_empty")}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMachine ? t("machine_dialog_edit") : t("machine_dialog_new")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="machine-name">{tc("name")} *</Label>
              <Input
                id="machine-name"
                placeholder={t("machine_name_placeholder")}
                value={formData.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("machine_volume_label")}</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Input
                    type="number"
                    placeholder="X"
                    value={formData.buildVolumeX}
                    onChange={(e) => field("buildVolumeX", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-center">{t("machine_width")}</p>
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Y"
                    value={formData.buildVolumeY}
                    onChange={(e) => field("buildVolumeY", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-center">{t("machine_depth")}</p>
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Z"
                    value={formData.buildVolumeZ}
                    onChange={(e) => field("buildVolumeZ", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-center">{t("machine_height")}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="machine-rate">{t("machine_rate_label")}</Label>
              <Input
                id="machine-rate"
                type="number"
                step="0.01"
                placeholder={t("machine_rate_placeholder")}
                value={formData.hourlyRate}
                onChange={(e) => field("hourlyRate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="machine-notes">{tc("notes")}</Label>
              <Textarea
                id="machine-notes"
                placeholder={t("machine_notes_placeholder")}
                value={formData.notes}
                onChange={(e) => field("notes", e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="machine-active"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => field("isActive", e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="machine-active">{t("machine_active")}</Label>
            </div>

            {editingMachine && (
              <div className="space-y-3 pt-3 border-t">
                <Label className="flex items-center gap-1.5">
                  <Printer className="h-4 w-4" />
                  {t("machine_conn_section")}
                </Label>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="conn-vendor" className="text-xs text-muted-foreground">
                      {t("machine_conn_vendor")}
                    </Label>
                    <Select value={formData.connVendor} onValueChange={selectVendor}>
                      <SelectTrigger id="conn-vendor" data-testid="conn-vendor">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("machine_conn_type_none")}</SelectItem>
                        {VENDORS.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.connVendor !== "none" && (
                    <div className="space-y-2">
                      <Label htmlFor="conn-model" className="text-xs text-muted-foreground">
                        {t("machine_conn_model")}
                      </Label>
                      <Select
                        value={formData.connProfile}
                        onValueChange={(v) => field("connProfile", v)}
                      >
                        <SelectTrigger id="conn-model" data-testid="conn-model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRINTER_PROFILES.filter((p) => p.vendor === formData.connVendor).map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.model}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {selectedProfile && selectedProfile.transport === "mock" && (
                  <div className="space-y-2">
                    <Label htmlFor="conn-mock" className="text-xs text-muted-foreground">
                      {t("machine_conn_mock_state")}
                    </Label>
                    <Select
                      value={formData.connMockState}
                      onValueChange={(v) => field("connMockState", v)}
                    >
                      <SelectTrigger id="conn-mock" data-testid="conn-mock-state">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["IDLE", "PRINTING", "FINISHED", "OFFLINE"].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedProfile && selectedProfile.transport !== "mock" && (
                  <>
                    {selectedProfile.transport === "prusalink" && (
                      <p className="text-xs text-muted-foreground">
                        {t("machine_conn_prusalink_hint")}
                      </p>
                    )}
                    {selectedProfile.transport === "prusa-connect" && (
                      <p className="text-xs text-muted-foreground">
                        {t("machine_conn_connect_hint")}
                      </p>
                    )}
                    {selectedProfile.fields.map((f) => (
                      <div className="space-y-2" key={f.key}>
                        <Label htmlFor={`conn-${f.key}`} className="text-xs text-muted-foreground">
                          {t(`machine_conn_field_${f.labelKey}`)}
                          {!f.required && ` (${t("machine_conn_optional")})`}
                        </Label>
                        <Input
                          id={`conn-${f.key}`}
                          type={f.key === "token" ? "password" : "text"}
                          data-testid={`conn-field-${f.key}`}
                          placeholder={f.key === "token" ? t("machine_conn_token_placeholder") : ""}
                          value={
                            f.key === "token"
                              ? formData.connToken
                              : f.key === "printerId"
                                ? formData.connPrinterId
                                : formData.connBaseUrl
                          }
                          onChange={(e) =>
                            field(
                              f.key === "token"
                                ? "connToken"
                                : f.key === "printerId"
                                  ? "connPrinterId"
                                  : "connBaseUrl",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    ))}
                  </>
                )}

                {formData.connVendor !== "none" && selectedProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={testing}
                    onClick={testConnection}
                    data-testid="conn-test"
                  >
                    {testing ? (
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    ) : (
                      <Printer className="h-3.5 w-3.5 mr-2" />
                    )}
                    {t("machine_conn_test")}
                  </Button>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? `${tc("save")}...` : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MachineDowntimeDialog
        open={downtimeOpen}
        onOpenChange={setDowntimeOpen}
        machine={downtimeMachine}
        allMachines={machines}
        onChanged={loadMachines}
      />
    </div>
  );
}

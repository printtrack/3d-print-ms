"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Building2, Scale, Mail, MessageSquare, Layers, LayoutList, FolderKanban, Users, Printer, FileText, Upload } from "lucide-react";
import Image from "next/image";
import { PhaseManager } from "@/components/admin/PhaseManager";
import { TeamManager } from "@/components/admin/TeamManager";
import { MachineManager } from "@/components/admin/MachineManager";
import { PartPhaseManager } from "@/components/admin/PartPhaseManager";
import { ProjectPhaseManagerInline } from "@/components/admin/ProjectPhaseManagerInline";
import type { ProjectPhaseData } from "@/components/admin/ProjectPhaseManager";

interface Phase {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isSurvey: boolean;
  isPrototype: boolean;
  _count: { orders: number };
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEAM_MEMBER";
  createdAt: string;
  _count: { assignedOrders: number };
}

interface Machine {
  id: string;
  name: string;
  buildVolumeX: number;
  buildVolumeY: number;
  buildVolumeZ: number;
  hourlyRate: number | null;
  notes: string | null;
  isActive: boolean;
  _count: { printJobs: number };
}

interface PartPhase {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isPrintReady: boolean;
  _count: { orderParts: number };
}

interface SettingsFormProps {
  initialSettings: Record<string, string>;
  defaultTab?: string;
  initialPhases: Phase[];
  initialMembers: TeamMember[];
  currentUserId: string;
  initialMachines: Machine[];
  initialPartPhases: PartPhase[];
  initialProjectPhases: ProjectPhaseData[];
}

function parseSurveyQuestions(raw: string | undefined): string[] {
  if (!raw) return ["Wie zufrieden waren Sie mit der Qualität?", "Wie würden Sie die Kommunikation bewerten?", "Würden Sie uns weiterempfehlen?"];
  try { return JSON.parse(raw); } catch { return []; }
}

const NAV_GROUPS = [
  {
    label: "Allgemein",
    items: [
      { key: "general", label: "Unternehmen", icon: Building2 },
      { key: "abrechnung", label: "Abrechnung", icon: Scale },
      { key: "belege", label: "Belege", icon: FileText },
      { key: "legal", label: "Rechtliches", icon: Scale },
    ],
  },
  {
    label: "Kommunikation",
    items: [
      { key: "emails", label: "E-Mails", icon: Mail },
      { key: "survey", label: "Umfrage", icon: MessageSquare },
    ],
  },
  {
    label: "Workflow",
    items: [
      { key: "phasen", label: "Phasen", icon: Layers },
      { key: "teilphasen", label: "Teilphasen", icon: LayoutList },
      { key: "projektphasen", label: "Projektphasen", icon: FolderKanban },
    ],
  },
  {
    label: "Ressourcen",
    items: [
      { key: "team", label: "Team", icon: Users },
      { key: "maschinen", label: "Maschinen", icon: Printer },
    ],
  },
];

const SETTINGS_SECTIONS = new Set(["general", "abrechnung", "belege", "emails", "survey", "legal"]);

export function SettingsForm({
  initialSettings,
  defaultTab,
  initialPhases,
  initialMembers,
  currentUserId,
  initialMachines,
  initialPartPhases,
  initialProjectPhases,
}: SettingsFormProps) {
  const [settings, setSettings] = useState<Record<string, string>>(initialSettings);
  const [surveyQuestions, setSurveyQuestions] = useState<string[]>(
    parseSurveyQuestions(initialSettings.survey_questions)
  );
  const [activeSection, setActiveSection] = useState(defaultTab ?? "general");

  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const hasChangedRef = useRef(false);

  function set(key: string, value: string) {
    hasChangedRef.current = true;
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function setSurveyQuestionsTracked(updater: string[] | ((prev: string[]) => string[])) {
    hasChangedRef.current = true;
    setSurveyQuestions(updater as Parameters<typeof setSurveyQuestions>[0]);
  }

  useEffect(() => {
    if (!hasChangedRef.current) return;
    if (!SETTINGS_SECTIONS.has(activeSection)) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const payload = {
          ...settings,
          survey_questions: JSON.stringify(surveyQuestions),
        };
        const res = await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        toast.success("Gespeichert");
      } catch {
        toast.error("Speichern fehlgeschlagen");
      }
    }, 1000);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, surveyQuestions]);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-8">
      {/* Sidebar */}
      <nav aria-label="Einstellungen-Navigation" className="md:w-44 md:shrink-0">
        {/* Mobile: horizontal scrollable pill tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 md:hidden">
          {NAV_GROUPS.flatMap((group) =>
            group.items.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                aria-current={activeSection === key ? "true" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors whitespace-nowrap ${
                  activeSection === key
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            ))
          )}
        </div>

        {/* Desktop: grouped sidebar */}
        <div className="hidden md:block space-y-5">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.label}>
              {groupIndex > 0 && <Separator className="mb-5" />}
              <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key)}
                    aria-current={activeSection === key ? "true" : undefined}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      activeSection === key
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Allgemein */}
        {activeSection === "general" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unternehmen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Unternehmensname</Label>
                <Input
                  id="company_name"
                  value={settings.company_name ?? ""}
                  onChange={(e) => set("company_name", e.target.value)}
                />
              </div>
              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="access_code_enabled">Zugangscode für Auftragsformular</Label>
                  <p className="text-xs text-muted-foreground">
                    Wenn aktiv, müssen Nutzer einen Code eingeben, um einen Auftrag einzureichen.
                  </p>
                </div>
                <Switch
                  id="access_code_enabled"
                  checked={settings.access_code_enabled === "true"}
                  onCheckedChange={(checked) => set("access_code_enabled", checked ? "true" : "false")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="access_code">Zugangscode</Label>
                <Input
                  id="access_code"
                  value={settings.access_code ?? ""}
                  onChange={(e) => set("access_code", e.target.value)}
                  placeholder="z. B. schule2024"
                  disabled={settings.access_code_enabled !== "true"}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="customer_verification_mode">Verifikation neu registrierter Kunden</Label>
                <p className="text-xs text-muted-foreground">
                  Legt fest, wie selbstregistrierte Kunden freigeschaltet werden, bevor sie Bestellungen aufgeben können.
                </p>
                <Select
                  value={settings.customer_verification_mode ?? "off"}
                  onValueChange={(v) => set("customer_verification_mode", v)}
                >
                  <SelectTrigger id="customer_verification_mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Keine Verifikation – Kunden sind sofort bestellberechtigt</SelectItem>
                    <SelectItem value="admin">Manuell durch Admin – Kunden unter „Kunden" freischalten</SelectItem>
                    <SelectItem value="email">Per E-Mail-Bestätigung – Kunden erhalten einen Bestätigungs-Link</SelectItem>
                  </SelectContent>
                </Select>
                {(settings.customer_verification_mode === "email") && (
                  <p className="text-xs text-amber-600">
                    Bitte E-Mail-Vorlage unter dem Tab „E-Mails" konfigurieren (Schlüssel: Kundenverifikation).
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* E-Mails */}
        {activeSection === "emails" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">E-Mail: Allgemein</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Absender-E-Mail</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={settings.contact_email ?? ""}
                    onChange={(e) => set("contact_email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_signature">E-Mail-Signatur</Label>
                  <Input
                    id="company_signature"
                    value={settings.company_signature ?? ""}
                    onChange={(e) => set("company_signature", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">E-Mail: Statusänderung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Verfügbare Variablen:{" "}
                  <code className="bg-muted px-1 rounded">{"{{customerName}}"}</code>{" "}
                  <code className="bg-muted px-1 rounded">{"{{phaseName}}"}</code>{" "}
                  <code className="bg-muted px-1 rounded">{"{{trackingUrl}}"}</code>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email_phase_subject">Betreff</Label>
                  <Input
                    id="email_phase_subject"
                    value={settings.email_phase_subject ?? ""}
                    onChange={(e) => set("email_phase_subject", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_phase_body">Inhalt</Label>
                  <Textarea
                    id="email_phase_body"
                    rows={4}
                    value={settings.email_phase_body ?? ""}
                    onChange={(e) => set("email_phase_body", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">E-Mail: Auftragsbestätigung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Verfügbare Variablen:{" "}
                  <code className="bg-muted px-1 rounded">{"{{customerName}}"}</code>{" "}
                  <code className="bg-muted px-1 rounded">{"{{trackingUrl}}"}</code>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email_confirm_subject">Betreff</Label>
                  <Input
                    id="email_confirm_subject"
                    value={settings.email_confirm_subject ?? ""}
                    onChange={(e) => set("email_confirm_subject", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_confirm_body">Inhalt</Label>
                  <Textarea
                    id="email_confirm_body"
                    rows={4}
                    value={settings.email_confirm_body ?? ""}
                    onChange={(e) => set("email_confirm_body", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">E-Mail: Freigabeanfrage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Verfügbare Variablen:{" "}
                  <code className="bg-muted px-1 rounded">{"{{customerName}}"}</code>{" "}
                  <code className="bg-muted px-1 rounded">{"{{phaseName}}"}</code>{" "}
                  <code className="bg-muted px-1 rounded">{"{{trackingUrl}}"}</code>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email_verification_subject">Betreff</Label>
                  <Input
                    id="email_verification_subject"
                    value={settings.email_verification_subject ?? ""}
                    onChange={(e) => set("email_verification_subject", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_verification_body">Inhalt</Label>
                  <Textarea
                    id="email_verification_body"
                    rows={4}
                    value={settings.email_verification_body ?? ""}
                    onChange={(e) => set("email_verification_body", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">E-Mail: Passwort zurücksetzen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Verfügbare Variablen:{" "}
                  <code className="bg-muted px-1 rounded">{"{{name}}"}</code>{" "}
                  <code className="bg-muted px-1 rounded">{"{{resetUrl}}"}</code>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email_reset_subject">Betreff</Label>
                  <Input
                    id="email_reset_subject"
                    value={settings.email_reset_subject ?? ""}
                    onChange={(e) => set("email_reset_subject", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_reset_body">Inhalt</Label>
                  <Textarea
                    id="email_reset_body"
                    rows={5}
                    value={settings.email_reset_body ?? ""}
                    onChange={(e) => set("email_reset_body", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">E-Mail: Kundenverifikation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Wird versendet, wenn Verifikationsmodus „Per E-Mail-Bestätigung" aktiv ist. Verfügbare Variablen: <code className="font-mono">{"{{name}}"}</code>, <code className="font-mono">{"{{verificationUrl}}"}</code>, <code className="font-mono">{"{{companyName}}"}</code>.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email_customer_verify_subject">Betreff</Label>
                  <Input
                    id="email_customer_verify_subject"
                    value={settings.email_customer_verify_subject ?? ""}
                    onChange={(e) => set("email_customer_verify_subject", e.target.value)}
                    placeholder="{{companyName}}: Konto bestätigen"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_customer_verify_body">Inhalt</Label>
                  <Textarea
                    id="email_customer_verify_body"
                    rows={5}
                    value={settings.email_customer_verify_body ?? ""}
                    onChange={(e) => set("email_customer_verify_body", e.target.value)}
                    placeholder={"Hallo {{name}},\n\nbitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren.\nDieser Link ist 24 Stunden gültig."}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">E-Mail: Kundennachricht</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Wird versendet, wenn das Team eine direkte Nachricht an den Kunden sendet (Tab „Kundenkontakt" auf der Auftragsseite). Verfügbare Variablen: <code className="font-mono">{"{{customerName}}"}</code>, <code className="font-mono">{"{{messageBody}}"}</code>, <code className="font-mono">{"{{trackingUrl}}"}</code>, <code className="font-mono">{"{{companyName}}"}</code>.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email_customer_message_subject_de">Betreff (Deutsch)</Label>
                  <Input
                    id="email_customer_message_subject_de"
                    value={settings.email_customer_message_subject_de ?? ""}
                    onChange={(e) => set("email_customer_message_subject_de", e.target.value)}
                    placeholder="Nachricht zu deinem Auftrag bei {{companyName}}"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_customer_message_body_de">Inhalt (Deutsch)</Label>
                  <Textarea
                    id="email_customer_message_body_de"
                    rows={5}
                    value={settings.email_customer_message_body_de ?? ""}
                    onChange={(e) => set("email_customer_message_body_de", e.target.value)}
                    placeholder={"wir haben eine Nachricht zu deinem 3D-Druck-Auftrag:\n\n{{messageBody}}\n\nDen aktuellen Status deines Auftrags kannst du jederzeit einsehen:"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_customer_message_subject_en">Betreff (Englisch)</Label>
                  <Input
                    id="email_customer_message_subject_en"
                    value={settings.email_customer_message_subject_en ?? ""}
                    onChange={(e) => set("email_customer_message_subject_en", e.target.value)}
                    placeholder="Message regarding your order at {{companyName}}"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_customer_message_body_en">Inhalt (Englisch)</Label>
                  <Textarea
                    id="email_customer_message_body_en"
                    rows={5}
                    value={settings.email_customer_message_body_en ?? ""}
                    onChange={(e) => set("email_customer_message_body_en", e.target.value)}
                    placeholder={"we have a message regarding your 3D print order:\n\n{{messageBody}}\n\nYou can check the current status of your order at any time:"}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Umfrage */}
        {activeSection === "survey" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kundenzufriedenheit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="survey_enabled">Umfragen aktiviert</Label>
                <Switch
                  id="survey_enabled"
                  checked={settings.survey_enabled === "true"}
                  onCheckedChange={(checked) => set("survey_enabled", checked ? "true" : "false")}
                />
              </div>

              <div className="space-y-2">
                <Label>Umfragefragen</Label>
                <div className="space-y-2">
                  {surveyQuestions.map((q, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={q}
                        onChange={(e) => {
                          const next = [...surveyQuestions];
                          next[i] = e.target.value;
                          setSurveyQuestionsTracked(next);
                        }}
                        placeholder={`Frage ${i + 1}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => setSurveyQuestionsTracked((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSurveyQuestionsTracked((prev) => [...prev, ""])}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Frage hinzufügen
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Verfügbare Variablen:{" "}
                <code className="bg-muted px-1 rounded">{"{{customerName}}"}</code>{" "}
                <code className="bg-muted px-1 rounded">{"{{surveyUrl}}"}</code>
              </p>
              <div className="space-y-2">
                <Label htmlFor="survey_email_subject">E-Mail-Betreff</Label>
                <Input
                  id="survey_email_subject"
                  value={settings.survey_email_subject ?? ""}
                  onChange={(e) => set("survey_email_subject", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey_email_body">E-Mail-Inhalt</Label>
                <Textarea
                  id="survey_email_body"
                  rows={3}
                  value={settings.survey_email_body ?? ""}
                  onChange={(e) => set("survey_email_body", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Abrechnung */}
        {activeSection === "abrechnung" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Abrechnung</CardTitle>
              <p className="text-sm text-muted-foreground">
                Lege fest, wie gedruckte Teile dem Kunden über sein Guthaben berechnet werden.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="charge_misprints">Fehldrucke berechnen</Label>
                  <p className="text-xs text-muted-foreground">
                    Wird Filament für Fehldrucke dem Kunden in Rechnung gestellt?
                  </p>
                </div>
                <Switch
                  id="charge_misprints"
                  checked={settings.charge_misprints === "true"}
                  onCheckedChange={(checked) => set("charge_misprints", checked ? "true" : "false")}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="charge_prototypes">Prototypen berechnen</Label>
                  <p className="text-xs text-muted-foreground">
                    Werden Prototyp-Aufträge dem Kunden berechnet?
                  </p>
                </div>
                <Switch
                  id="charge_prototypes"
                  checked={settings.charge_prototypes === "true"}
                  onCheckedChange={(checked) => set("charge_prototypes", checked ? "true" : "false")}
                />
              </div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Angebotsfreigabe</h3>
                  <p className="text-xs text-muted-foreground">
                    Steuert, wann ein Auftrag erst nach Kundenfreigabe weiter darf.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="require_quote_approval">Freigabe erforderlich</Label>
                    <p className="text-xs text-muted-foreground">
                      Wenn aktiv, kann ein Auftrag erst aus &quot;In Prüfung&quot; verschoben werden, sobald der Kunde das Angebot bestätigt hat.
                    </p>
                  </div>
                  <Switch
                    id="require_quote_approval"
                    checked={settings.require_quote_approval === "true"}
                    onCheckedChange={(checked) => set("require_quote_approval", checked ? "true" : "false")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote_approval_min_cents">Mindestbetrag für Freigabe (€)</Label>
                  <Input
                    id="quote_approval_min_cents"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      settings.quote_approval_min_cents
                        ? (Number(settings.quote_approval_min_cents) / 100).toFixed(2)
                        : "0.00"
                    }
                    onChange={(e) => {
                      const euros = parseFloat(e.target.value || "0");
                      const cents = isNaN(euros) ? 0 : Math.round(euros * 100);
                      set("quote_approval_min_cents", String(cents));
                    }}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Aufträge unterhalb dieses Betrags können auch ohne Kundenfreigabe weiter. 0 = immer Freigabe verlangen.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Mahnwesen</h3>
                  <p className="text-xs text-muted-foreground">
                    Steuert die automatischen Zahlungserinnerungen und Mahnungen für offene Rechnungen.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="payment_reminders_enabled">Erinnerungen aktivieren</Label>
                    <p className="text-xs text-muted-foreground">
                      Wenn aktiv, verschickt das System automatisch Zahlungserinnerungen und Mahnungen.
                    </p>
                  </div>
                  <Switch
                    id="payment_reminders_enabled"
                    checked={settings.payment_reminders_enabled !== "false"}
                    onCheckedChange={(checked) =>
                      set("payment_reminders_enabled", checked ? "true" : "false")
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="payment_reminder_days_before">Vor-Fälligkeit (Tage)</Label>
                    <Input
                      id="payment_reminder_days_before"
                      type="number"
                      min="0"
                      value={settings.payment_reminder_days_before ?? "3"}
                      onChange={(e) =>
                        set("payment_reminder_days_before", e.target.value || "0")
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Erinnerung X Tage vor Fälligkeit.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_reminder_days_after_1">Erinnerung (Tage nach Fälligkeit)</Label>
                    <Input
                      id="payment_reminder_days_after_1"
                      type="number"
                      min="1"
                      value={settings.payment_reminder_days_after_1 ?? "7"}
                      onChange={(e) =>
                        set("payment_reminder_days_after_1", e.target.value || "7")
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_reminder_days_after_2">1. Mahnung (Tage)</Label>
                    <Input
                      id="payment_reminder_days_after_2"
                      type="number"
                      min="1"
                      value={settings.payment_reminder_days_after_2 ?? "21"}
                      onChange={(e) =>
                        set("payment_reminder_days_after_2", e.target.value || "21")
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_reminder_days_after_3">2. Mahnung (Tage)</Label>
                    <Input
                      id="payment_reminder_days_after_3"
                      type="number"
                      min="1"
                      value={settings.payment_reminder_days_after_3 ?? "42"}
                      onChange={(e) =>
                        set("payment_reminder_days_after_3", e.target.value || "42")
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_reminder_fee_2_cents">Gebühr 1. Mahnung (€)</Label>
                    <Input
                      id="payment_reminder_fee_2_cents"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        settings.payment_reminder_fee_2_cents
                          ? (Number(settings.payment_reminder_fee_2_cents) / 100).toFixed(2)
                          : "5.00"
                      }
                      onChange={(e) => {
                        const euros = parseFloat(e.target.value || "0");
                        const cents = isNaN(euros) ? 0 : Math.round(euros * 100);
                        set("payment_reminder_fee_2_cents", String(cents));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_reminder_fee_3_cents">Gebühr 2. Mahnung (€)</Label>
                    <Input
                      id="payment_reminder_fee_3_cents"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        settings.payment_reminder_fee_3_cents
                          ? (Number(settings.payment_reminder_fee_3_cents) / 100).toFixed(2)
                          : "10.00"
                      }
                      onChange={(e) => {
                        const euros = parseFloat(e.target.value || "0");
                        const cents = isNaN(euros) ? 0 : Math.round(euros * 100);
                        set("payment_reminder_fee_3_cents", String(cents));
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Jede Stufe wird pro Rechnung höchstens einmal verschickt. Mail-Texte können unter
                  &quot;E-Mails&quot; angepasst werden.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Belege (PDF-Branding) */}
        {activeSection === "belege" && (
          <BelegeSection
            settings={settings}
            set={set}
            onLogoChanged={(url) => set("billing_logo_url", url)}
          />
        )}

        {/* Rechtliches */}
        {activeSection === "legal" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Angaben für Impressum &amp; Datenschutz</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Diese Angaben erscheinen unter{" "}
                <a href="/impressum" target="_blank" className="underline">/impressum</a> und{" "}
                <a href="/datenschutz" target="_blank" className="underline">/datenschutz</a>.
              </p>
              <div className="space-y-2">
                <Label htmlFor="legal_name">Vollständiger Name / Firma</Label>
                <Input
                  id="legal_name"
                  value={settings.legal_name ?? ""}
                  onChange={(e) => set("legal_name", e.target.value)}
                  placeholder="Max Mustermann"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_street">Straße und Hausnummer</Label>
                <Input
                  id="legal_street"
                  value={settings.legal_street ?? ""}
                  onChange={(e) => set("legal_street", e.target.value)}
                  placeholder="Musterstraße 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_city">PLZ und Ort</Label>
                <Input
                  id="legal_city"
                  value={settings.legal_city ?? ""}
                  onChange={(e) => set("legal_city", e.target.value)}
                  placeholder="12345 Musterstadt"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_phone">Telefonnummer</Label>
                <Input
                  id="legal_phone"
                  value={settings.legal_phone ?? ""}
                  onChange={(e) => set("legal_phone", e.target.value)}
                  placeholder="+49 (0) 123 456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_email">E-Mail-Adresse</Label>
                <Input
                  id="legal_email"
                  type="email"
                  value={settings.legal_email ?? ""}
                  onChange={(e) => set("legal_email", e.target.value)}
                  placeholder="info@beispiel.de"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team */}
        {activeSection === "team" && (
          <TeamManager initialMembers={initialMembers} currentUserId={currentUserId} />
        )}

        {/* Phasen */}
        {activeSection === "phasen" && (
          <PhaseManager initialPhases={initialPhases} />
        )}

        {/* Teilphasen */}
        {activeSection === "teilphasen" && (
          <PartPhaseManager initialPartPhases={initialPartPhases} />
        )}

        {/* Projektphasen */}
        {activeSection === "projektphasen" && (
          <ProjectPhaseManagerInline initialPhases={initialProjectPhases} />
        )}

        {/* Maschinen */}
        {activeSection === "maschinen" && (
          <MachineManager initialMachines={initialMachines} />
        )}


      </div>
    </div>
  );
}

interface BelegeSectionProps {
  settings: Record<string, string>;
  set: (key: string, value: string) => void;
  onLogoChanged: (url: string) => void;
}

function BelegeSection({ settings, set, onLogoChanged }: BelegeSectionProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isKleinunternehmer = settings.billing_kleinunternehmer === "true";
  const logoUrl = settings.billing_logo_url ?? "";

  async function handleLogoUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/uploads/branding", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload fehlgeschlagen");
      onLogoChanged(data.url);
      toast.success("Logo aktualisiert");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo-Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleLogoDelete() {
    if (!confirm("Logo wirklich entfernen?")) return;
    try {
      const res = await fetch("/api/admin/uploads/branding", { method: "DELETE" });
      if (!res.ok) throw new Error();
      onLogoChanged("");
      toast.success("Logo entfernt");
    } catch {
      toast.error("Logo konnte nicht entfernt werden");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Belege (Angebot &amp; Rechnung)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Diese Angaben erscheinen auf jedem PDF, das an Kunden verschickt wird.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <div className="relative h-20 w-40 overflow-hidden rounded-md border bg-white">
                <Image
                  src={logoUrl}
                  alt="Firmenlogo"
                  fill
                  sizes="160px"
                  className="object-contain p-2"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-20 w-40 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                Kein Logo
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Lädt …" : logoUrl ? "Ersetzen" : "Hochladen"}
              </Button>
              {logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleLogoDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Entfernen
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">JPG, PNG oder SVG · max. 1 MB</p>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Absenderadresse</h3>
          <div className="space-y-2">
            <Label htmlFor="billing_company_name">Firmenname (überschreibt Unternehmensname)</Label>
            <Input
              id="billing_company_name"
              value={settings.billing_company_name ?? ""}
              onChange={(e) => set("billing_company_name", e.target.value)}
              placeholder={settings.company_name ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_company_address_line1">Straße &amp; Hausnummer</Label>
            <Input
              id="billing_company_address_line1"
              value={settings.billing_company_address_line1 ?? ""}
              onChange={(e) => set("billing_company_address_line1", e.target.value)}
              placeholder="Musterstraße 1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_company_address_line2">Adresszusatz (optional)</Label>
            <Input
              id="billing_company_address_line2"
              value={settings.billing_company_address_line2 ?? ""}
              onChange={(e) => set("billing_company_address_line2", e.target.value)}
              placeholder="z. B. c/o, Gebäude, Etage"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billing_company_city">PLZ &amp; Ort</Label>
              <Input
                id="billing_company_city"
                value={settings.billing_company_city ?? ""}
                onChange={(e) => set("billing_company_city", e.target.value)}
                placeholder="12345 Musterstadt"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_company_country">Land</Label>
              <Input
                id="billing_company_country"
                value={settings.billing_company_country ?? ""}
                onChange={(e) => set("billing_company_country", e.target.value)}
                placeholder="Deutschland"
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Steuer</h3>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="billing_kleinunternehmer">Kleinunternehmer nach §19 UStG</Label>
              <p className="text-xs text-muted-foreground">
                Versteckt die USt-Spalte und druckt einen entsprechenden Hinweis auf jedem Beleg.
              </p>
            </div>
            <Switch
              id="billing_kleinunternehmer"
              checked={isKleinunternehmer}
              onCheckedChange={(checked) => set("billing_kleinunternehmer", checked ? "true" : "false")}
            />
          </div>
          {!isKleinunternehmer && (
            <div className="space-y-2">
              <Label htmlFor="billing_tax_id">USt-IdNr.</Label>
              <Input
                id="billing_tax_id"
                value={settings.billing_tax_id ?? ""}
                onChange={(e) => set("billing_tax_id", e.target.value)}
                placeholder="DE123456789"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="billing_steuer_nr">Steuernummer (Fallback)</Label>
            <Input
              id="billing_steuer_nr"
              value={settings.billing_steuer_nr ?? ""}
              onChange={(e) => set("billing_steuer_nr", e.target.value)}
              placeholder="12/345/67890"
            />
          </div>
          {!isKleinunternehmer && (
            <div className="space-y-2">
              <Label htmlFor="billing_default_tax_rate">Standard-MwSt.-Satz (%)</Label>
              <Input
                id="billing_default_tax_rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.billing_default_tax_rate ?? ""}
                onChange={(e) => set("billing_default_tax_rate", e.target.value)}
                placeholder="19"
              />
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Bankverbindung</h3>
          <div className="space-y-2">
            <Label htmlFor="billing_bank_name">Bankname</Label>
            <Input
              id="billing_bank_name"
              value={settings.billing_bank_name ?? ""}
              onChange={(e) => set("billing_bank_name", e.target.value)}
              placeholder="Musterbank"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_iban">IBAN</Label>
            <Input
              id="billing_iban"
              value={settings.billing_iban ?? ""}
              onChange={(e) => set("billing_iban", e.target.value)}
              placeholder="DE00 0000 0000 0000 0000 00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_bic">BIC</Label>
            <Input
              id="billing_bic"
              value={settings.billing_bic ?? ""}
              onChange={(e) => set("billing_bic", e.target.value)}
              placeholder="ABCDEF1XXX"
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Erscheinungsbild &amp; Footer</h3>
          <div className="space-y-2">
            <Label htmlFor="billing_accent_color">Akzentfarbe (HEX)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="billing_accent_color"
                value={settings.billing_accent_color ?? ""}
                onChange={(e) => set("billing_accent_color", e.target.value)}
                placeholder="#d97706"
                className="font-mono"
              />
              <div
                className="h-9 w-9 shrink-0 rounded-md border"
                style={{ backgroundColor: settings.billing_accent_color || "#d97706" }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Wird als Trennerlinie und Nummern-Highlight im PDF verwendet.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_footer_de">Footer-Text (Deutsch)</Label>
            <Textarea
              id="billing_footer_de"
              rows={3}
              value={settings.billing_footer_de ?? ""}
              onChange={(e) => set("billing_footer_de", e.target.value)}
              placeholder="z. B. Geschäftsführer, Registergericht, Gerichtsstand …"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_footer_en">Footer-Text (Englisch)</Label>
            <Textarea
              id="billing_footer_en"
              rows={3}
              value={settings.billing_footer_en ?? ""}
              onChange={(e) => set("billing_footer_en", e.target.value)}
              placeholder="e. g. Managing director, register court …"
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Nummerierung</h3>
          <div className="space-y-2">
            <Label htmlFor="quote_number_prefix">Angebots-Präfix</Label>
            <Input
              id="quote_number_prefix"
              value={settings.quote_number_prefix ?? ""}
              onChange={(e) => set("quote_number_prefix", e.target.value)}
              placeholder="ANG-"
            />
            <p className="text-xs text-muted-foreground">
              Format: <code>{"{Präfix}{Jahr}-{0001}"}</code> · z. B. <code>ANG-2026-0042</code>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

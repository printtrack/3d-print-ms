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
import { Plus, Trash2, Building2, Scale, Mail, MessageSquare, Layers, LayoutList, FolderKanban, Users, Printer } from "lucide-react";
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

const SETTINGS_SECTIONS = new Set(["general", "abrechnung", "emails", "survey", "legal"]);

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
            </CardContent>
          </Card>
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

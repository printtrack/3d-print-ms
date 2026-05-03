"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveEvents } from "@/lib/use-live-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssigneePicker } from "@/components/admin/AssigneePicker";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";
import { FileManager } from "@/components/admin/files/FileManager";
import { type OrderPartData } from "@/components/admin/files/PartFileSection";
import type { OrderFileData } from "@/components/admin/files/types";
import {
  Archive,
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  Flag,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  Wallet,
  X,
  CheckCircle2,
  Circle,
  FlaskConical,
} from "lucide-react";
import { MilestoneDialog } from "@/components/admin/MilestoneDialog";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";


interface MilestoneTaskData {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  assignees: { user: { id: string; name: string } }[];
  position: number;
}

interface MilestoneData {
  id: string;
  orderId: string | null;
  projectId?: string | null;
  name: string;
  description: string | null;
  dueAt: string | null;
  completedAt: string | null;
  color: string;
  position: number;
  tasks: MilestoneTaskData[];
}

interface FilamentOption {
  id: string;
  name: string;
  material: string;
  color: string;
  colorHex: string | null;
  brand: string | null;
  remainingGrams: number;
}


interface OrderDetailProps {
  order: {
    id: string;
    trackingToken: string;
    customerName: string;
    customerEmail: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
    deadline: string | null;
    estimatedCompletionAt: string | null;
    priceEstimate: number | null;
    isPrototype: boolean;
    iterationCount: number;
    phase: { id: string; name: string; color: string; isPrototype?: boolean };
    phaseId: string;
    project?: { id: string; name: string } | null;
    assignees: Array<{ id: string; name: string; email: string }>;
    files: Array<{
      id: string;
      filename: string;
      originalName: string;
      mimeType: string;
      size: number;
      source: "CUSTOMER" | "TEAM";
      category: "REFERENCE" | "DESIGN" | "RESULT" | "OTHER";
      orderPartId: string | null;
      createdAt: string;
    }>;
    comments: Array<{
      id: string;
      content: string;
      createdAt: string;
      author: { id: string; name: string; email: string };
    }>;
    auditLogs: Array<{
      id: string;
      action: string;
      details: string | null;
      createdAt: string;
      user: { id: string; name: string } | null;
    }>;
    surveyResponse?: {
      token: string;
      sentAt: string;
      submittedAt: string | null;
      answers: Array<{ question: string; rating: number }> | null;
      comment: string | null;
    } | null;
    verificationRequests?: Array<{
      id: string;
      type: "DESIGN_REVIEW" | "PRICE_APPROVAL";
      status: "PENDING" | "APPROVED" | "REJECTED";
      sentAt: string;
      resolvedAt: string | null;
      orderPartId: string | null;
      rejectionReason?: string | null;
    }>;
  };
  phases: Array<{ id: string; name: string; color: string; isPrototype?: boolean }>;
  teamMembers: Array<{ id: string; name: string; email: string }>;
  currentUserId: string;
  isAdmin: boolean;
  parts: OrderPartData[];
  availableFilaments: FilamentOption[];
  customerCredit: { id: string; balance: number } | null;
  partPhases: Array<{ id: string; name: string; color: string; isPrintReady: boolean; isReview: boolean; isPrinted: boolean }>;
  machines: Array<{ id: string; name: string }>;
  initialMilestones: MilestoneData[];
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    ORDER_CREATED: "Auftrag eingereicht",
    PHASE_CHANGED: "Status geändert",
    ASSIGNED: "Bearbeiter geändert",
    COMMENT_ADDED: "Kommentar hinzugefügt",
    FILE_UPLOADED: "Datei hochgeladen",
    TEAM_FILE_UPLOADED: "Designdatei vom Team hochgeladen",
    PART_ITERATION_INCREMENTED: "Teil-Iteration erhöht",
    ORDER_ARCHIVED: "Auftrag archiviert",
    ORDER_UNARCHIVED: "Auftrag wiederhergestellt",
    DEADLINE_SET: "Deadline geändert",
    PRICE_SET: "Angebot aktualisiert",
    MATERIAL_ASSIGNED: "Material zugewiesen",
    MATERIAL_REMOVED: "Material entfernt",
    SURVEY_SENT: "Umfrage versandt",
    SURVEY_SUBMITTED: "Umfrage ausgefüllt",
    VERIFICATION_SENT: "Freigabeanfrage versandt",
    VERIFICATION_APPROVED: "Freigabe erteilt",
    VERIFICATION_REJECTED: "Freigabe abgelehnt",
    VERIFICATION_OVERRIDDEN: "Freigabe durch Admin erteilt",
    JOB_ASSIGNED: "Druckauftrag zugewiesen",
    JOB_REMOVED: "Vom Druckauftrag entfernt",
    JOB_STARTED: "Druckstart",
    JOB_COMPLETED: "Druck abgeschlossen",
    PART_ADDED: "Teil hinzugefügt",
    PART_REMOVED: "Teil entfernt",
    PART_UPDATED: "Teil aktualisiert",
    PROTOTYPE_ENABLED: "Prototyp-Modus aktiviert",
    PROTOTYPE_DISABLED: "Prototyp-Modus deaktiviert",
    ITERATION_INCREMENTED: "Iteration erhöht",
  };
  return labels[action] ?? action;
}

export function OrderDetail({ order, phases, teamMembers, currentUserId, isAdmin, parts: initialParts, availableFilaments, customerCredit: initialCustomerCredit, partPhases, machines, initialMilestones }: OrderDetailProps) {
  const router = useRouter();
  const [selectedPhaseId, setSelectedPhaseId] = useState(order.phaseId);
  const [parts, setParts] = useState<OrderPartData[]>(initialParts);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(
    order.assignees.map((a) => a.id)
  );
  const [deadlineValue, setDeadlineValue] = useState(
    order.deadline ? new Date(order.deadline).toISOString().split("T")[0] : ""
  );
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(order.comments);
  const [priceValue, setPriceValue] = useState(
    order.priceEstimate != null ? order.priceEstimate.toFixed(2) : ""
  );
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [savingPhase, setSavingPhase] = useState(false);
  const [savingAssignees, setSavingAssignees] = useState(false);
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const savedAssigneeIds = useRef<string[]>(order.assignees.map((a) => a.id));
  const savedDeadlineValue = useRef(
    order.deadline ? new Date(order.deadline).toISOString().split("T")[0] : ""
  );
  const savedPriceValue = useRef(
    order.priceEstimate != null ? order.priceEstimate.toFixed(2) : ""
  );
  const [commenting, setCommenting] = useState(false);
  const [isPrototype, setIsPrototype] = useState(order.isPrototype);
  const [iterationCount, setIterationCount] = useState(order.iterationCount);
  const [togglingPrototype, setTogglingPrototype] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isArchived, setIsArchived] = useState(!!order.archivedAt);
  const [files, setFiles] = useState<OrderFileData[]>(order.files);
  const [verificationRequests, setVerificationRequests] = useState(
    order.verificationRequests ?? []
  );
  const [overridingVerification, setOverridingVerification] = useState<string | null>(null);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [customerCredit, setCustomerCredit] = useState(initialCustomerCredit);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditGrams, setCreditGrams] = useState(() => {
    const total = initialParts.reduce((s, p) => s + (p.gramsEstimated ?? 0) * (p.quantity ?? 1), 0);
    return total > 0 ? String(total) : "";
  });
  const [creditReason, setCreditReason] = useState(
    `Abzug für Auftrag vom ${new Date(order.createdAt).toLocaleDateString("de-DE")}`
  );
  const [savingCredit, setSavingCredit] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneData[]>(initialMilestones);
  const [milestoneDialog, setMilestoneDialog] = useState<{ open: boolean; milestone: MilestoneData | null }>({ open: false, milestone: null });

  const orderId = order.id;
  useLiveEvents(
    useCallback(
      (event) => {
        if (
          (event.type === "order.changed" ||
            event.type === "comment.added" ||
            event.type === "verification.changed") &&
          event.orderId === orderId
        ) {
          router.refresh();
        }
      },
      [orderId, router]
    )
  );

  // Sync server-provided lists from props when they change after router.refresh()
  useEffect(() => {
    setVerificationRequests(order.verificationRequests ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.verificationRequests]);

  useEffect(() => {
    setComments(order.comments);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.comments]);

  useEffect(() => {
    setParts(initialParts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialParts]);

  const currentPhase = phases.find((p) => p.id === selectedPhaseId);
  const currentPhaseIsPrototype = !!currentPhase?.isPrototype;

  const designApproved = verificationRequests.some((vr) => vr.type === "DESIGN_REVIEW" && vr.status === "APPROVED");
  const priceRequest = verificationRequests.find((vr) => vr.type === "PRICE_APPROVAL");
  const hasPendingPrice = priceRequest?.status === "PENDING";

  async function handleDeductCredit() {
    if (!customerCredit) return;
    const grams = parseInt(creditGrams, 10);
    if (!grams || grams <= 0) {
      toast.error("Bitte eine gültige Grammzahl eingeben");
      return;
    }
    if (!creditReason.trim()) {
      toast.error("Bitte einen Grund angeben");
      return;
    }
    setSavingCredit(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerCredit.id}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: -grams, reason: creditReason.trim(), orderId: order.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Fehler");
        return;
      }
      setCustomerCredit((prev) => prev ? { ...prev, balance: prev.balance - grams } : prev);
      setShowCreditForm(false);
      toast.success("Guthaben abgezogen");
    } catch {
      toast.error("Fehler beim Abziehen");
    } finally {
      setSavingCredit(false);
    }
  }

  function handleMilestoneSaved(saved: MilestoneData) {
    setMilestones((prev) => {
      const exists = prev.find((m) => m.id === saved.id);
      if (exists) return prev.map((m) => (m.id === saved.id ? saved : m));
      return [...prev, saved].sort((a, b) => a.position - b.position);
    });
  }

  function handleMilestoneDeleted(id: string) {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleToggleMilestoneComplete(m: MilestoneData) {
    const newCompletedAt = m.completedAt ? null : new Date().toISOString();
    setMilestones((prev) =>
      prev.map((ms) => (ms.id === m.id ? { ...ms, completedAt: newCompletedAt } : ms))
    );
    try {
      const res = await fetch(`/api/admin/milestones/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: newCompletedAt }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setMilestones((prev) => prev.map((ms) => (ms.id === m.id ? saved : ms)));
    } catch {
      setMilestones((prev) =>
        prev.map((ms) => (ms.id === m.id ? { ...ms, completedAt: m.completedAt } : ms))
      );
      toast.error("Fehler beim Aktualisieren");
    }
  }

  async function handleSendVerification(type: "DESIGN_REVIEW" | "PRICE_APPROVAL") {
    setSendingVerification(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Fehler beim Senden");
        return;
      }
      const newVr = await res.json();
      setVerificationRequests((prev) => [newVr, ...prev]);
      toast.success("Freigabeanfrage versandt");
    } catch {
      toast.error("Fehler beim Senden");
    } finally {
      setSendingVerification(false);
    }
  }

  async function handleSavePhase(phaseId: string) {
    setSelectedPhaseId(phaseId);
    setSavingPhase(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Phase gespeichert");
      router.refresh();
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSavingPhase(false);
    }
  }

  async function handleSaveAssignees(assigneeIds: string[]) {
    const current = [...assigneeIds].sort().join(",");
    const saved = [...savedAssigneeIds.current].sort().join(",");
    if (current === saved) return;
    setSavingAssignees(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeIds }),
      });
      if (!res.ok) throw new Error();
      savedAssigneeIds.current = assigneeIds;
      toast.success("Zuweisung gespeichert");
      router.refresh();
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSavingAssignees(false);
    }
  }

  async function handleSaveDeadline(value: string) {
    if (value === savedDeadlineValue.current) return;
    setSavingDeadline(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadline: value ? new Date(value).toISOString() : null }),
      });
      if (!res.ok) throw new Error();
      savedDeadlineValue.current = value;
      toast.success("Deadline gespeichert");
      router.refresh();
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSavingDeadline(false);
    }
  }


  async function handleSavePrice() {
    if (priceValue === savedPriceValue.current) return;
    const parsed = priceValue.trim() === "" ? null : parseFloat(priceValue.replace(",", "."));
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      toast.error("Ungültiger Betrag");
      return;
    }
    setSavingPrice(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceEstimate: parsed }),
      });
      if (!res.ok) throw new Error();
      savedPriceValue.current = priceValue;
      toast.success("Angebot gespeichert");
      router.refresh();
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSavingPrice(false);
    }
  }

  async function handleAddComment() {
    if (!comment.trim()) return;
    setCommenting(true);

    try {
      const res = await fetch("/api/admin/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, content: comment }),
      });

      if (!res.ok) throw new Error("Comment failed");
      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      setComment("");
      toast.success("Kommentar hinzugefügt");
    } catch {
      toast.error("Kommentar fehlgeschlagen");
    } finally {
      setCommenting(false);
    }
  }

  async function handleToggleArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: !isArchived }),
      });
      if (!res.ok) throw new Error();
      setIsArchived(!isArchived);
      toast.success(isArchived ? "Auftrag wiederhergestellt" : "Auftrag archiviert");
      router.refresh();
    } catch {
      toast.error("Aktion fehlgeschlagen");
    } finally {
      setArchiving(false);
    }
  }

  async function handleTogglePrototype() {
    setTogglingPrototype(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrototype: !isPrototype }),
      });
      if (!res.ok) throw new Error();
      setIsPrototype(!isPrototype);
      toast.success(!isPrototype ? "Prototyp-Modus aktiviert" : "Prototyp-Modus deaktiviert");
      router.refresh();
    } catch {
      toast.error("Aktion fehlgeschlagen");
    } finally {
      setTogglingPrototype(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Auftrag dauerhaft gelöscht");
      router.push("/admin/orders");
    } catch {
      toast.error("Löschen fehlgeschlagen");
      setDeleting(false);
    }
  }

  async function refreshParts() {
    const partsRes = await fetch(`/api/admin/orders/${order.id}/parts`);
    if (partsRes.ok) {
      const updatedParts: Array<OrderPartData & { createdAt: unknown; updatedAt: unknown }> = await partsRes.json();
      setParts(
        updatedParts.map((p) => ({
          ...p,
          createdAt: String(p.createdAt),
          updatedAt: String(p.updatedAt),
          files: (
            p.files as Array<
              { createdAt: unknown } & Omit<OrderPartData["files"][number], "createdAt">
            >
          ).map((f) => ({ ...f, createdAt: String(f.createdAt) })),
        }))
      );
    }
    router.refresh();
  }

  async function handleOverrideVerification(verificationRequestId: string) {
    setOverridingVerification(verificationRequestId);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationRequestId, action: "APPROVE" }),
      });
      if (!res.ok) throw new Error();
      setVerificationRequests((prev) =>
        prev.map((vr) =>
          vr.id === verificationRequestId
            ? { ...vr, status: "APPROVED" as const, resolvedAt: new Date().toISOString() }
            : vr
        )
      );
      toast.success("Freigabe durch Admin erteilt");
      router.refresh();
    } catch {
      toast.error("Freigabe fehlgeschlagen");
    } finally {
      setOverridingVerification(null);
    }
  }

  function handleVerificationUpdated(vrId: string, status: "APPROVED" | "REJECTED", reason?: string | null) {
    setVerificationRequests((prev) =>
      prev.map((vr) =>
        vr.id === vrId
          ? { ...vr, status, rejectionReason: reason ?? null }
          : vr
      )
    );
  }

  function handlePartUpdated(updated: OrderPartData) {
    setParts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handlePartDeleted(partId: string) {
    setParts((prev) => prev.filter((p) => p.id !== partId));
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zum Board
        </Link>
      </div>

      <div
        className="flex flex-wrap items-start justify-between gap-4 pl-4 border-l-[3px]"
        style={{ borderLeftColor: order.phase.color }}
      >
        <div>
          <h1 className="text-2xl font-bold">{order.customerName}</h1>
          <p className="text-muted-foreground">{order.customerEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPrototype && (
            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200">
              <FlaskConical className="h-3 w-3 mr-1" />
              Prototyp · #{iterationCount}
            </Badge>
          )}
          <Badge style={{ backgroundColor: order.phase.color }} className="text-white">
            {order.phase.name}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Beschreibung</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{order.description}</p>
            </CardContent>
          </Card>

          {/* Files, Upload & Parts */}
          <FileManager
            orderId={order.id}
            files={files}
            onFilesChange={setFiles}
            parts={parts}
            isAdmin={isAdmin}
            onPartsRefresh={refreshParts}
            availableFilaments={availableFilaments}
            availablePartPhases={partPhases}
            machines={machines}
            onPartUpdated={handlePartUpdated}
            onPartDeleted={handlePartDeleted}
            onPartAdded={(part) => setParts((prev) => [...prev, part])}
            isPrototype={isPrototype && currentPhaseIsPrototype}
            iterationCount={iterationCount}
            onIterationChange={setIterationCount}
            teamMembers={teamMembers}
            verificationRequests={verificationRequests}
            onVerificationUpdated={handleVerificationUpdated}
          />

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Kommentare ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Noch keine Kommentare
                </p>
              )}

              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(c.author.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{c.author.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                  </div>
                </div>
              ))}

              <Separator />

              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Textarea
                    placeholder="Kommentar schreiben..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        handleAddComment();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddComment}
                    disabled={!comment.trim() || commenting}
                  >
                    <Send className="h-3 w-3 mr-2" />
                    {commenting ? "Senden..." : "Kommentieren"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status, Assignment & Deadline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground">Auftragssteuerung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phase</label>
                <Select value={selectedPhaseId} onValueChange={handleSavePhase} disabled={savingPhase}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {phases.map((phase) => (
                      <SelectItem key={phase.id} value={phase.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: phase.color }}
                          />
                          {phase.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Zugewiesen an</label>
                <AssigneePicker
                  users={teamMembers}
                  value={selectedAssigneeIds}
                  onChange={async (ids) => {
                    setSelectedAssigneeIds(ids);
                    await handleSaveAssignees(ids);
                  }}
                />
              </div>

              {savingAssignees && (
                <p className="text-xs text-muted-foreground text-center">Speichern...</p>
              )}

              {currentPhaseIsPrototype && (
                <div className="space-y-1 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-purple-600" />
                      Prototyp-Modus
                    </label>
                    <Switch
                      checked={isPrototype}
                      onCheckedChange={handleTogglePrototype}
                      disabled={togglingPrototype}
                    />
                  </div>
                  {isPrototype && (
                    <p className="text-xs text-purple-600 font-medium">Iteration #{iterationCount}</p>
                  )}
                </div>
              )}
              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">Deadline</label>
                <input
                  type="date"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={deadlineValue}
                  disabled={savingDeadline}
                  onChange={(e) => {
                    setDeadlineValue(e.target.value);
                    handleSaveDeadline(e.target.value);
                  }}
                />
                {savingDeadline && (
                  <p className="text-xs text-muted-foreground">Speichern...</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Wird auch als Gantt-Balken-Ende angezeigt
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Project link */}
          {order.project && (
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Projekt:</span>
                  <Link
                    href={`/admin/projects/${order.project.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {order.project.name}
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Meilensteine werden über das Projekt verwaltet.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Milestones — only shown for orders not in a project */}
          {!order.project && <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Flag className="h-4 w-4" />
                  Meilensteine ({milestones.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setMilestoneDialog({ open: true, milestone: null })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Neu
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0">
              {milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Meilensteine</p>
              ) : (
                [...milestones]
                  .sort((a, b) => {
                    if (a.completedAt && !b.completedAt) return 1;
                    if (!a.completedAt && b.completedAt) return -1;
                    if (!a.completedAt && !b.completedAt) {
                      if (a.dueAt && !b.dueAt) return -1;
                      if (!a.dueAt && b.dueAt) return 1;
                      if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
                    }
                    return a.position - b.position;
                  })
                  .map((m) => {
                    const isOverdue = !!m.dueAt && !m.completedAt && new Date(m.dueAt) < new Date();
                    const tasksDone = m.tasks.filter((t) => t.completed).length;
                    const tasksTotal = m.tasks.length;
                    const taskPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
                    return (
                  <div
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    className="w-full text-left flex items-start gap-2 rounded-md p-2 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => setMilestoneDialog({ open: true, milestone: m })}
                  >
                    <button
                      className="mt-0.5 shrink-0"
                      onClick={(e) => { e.stopPropagation(); handleToggleMilestoneComplete(m); }}
                      title={m.completedAt ? "Als offen markieren" : "Als erledigt markieren"}
                    >
                      {m.completedAt ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Circle className={`h-4 w-4 ${isOverdue ? "animate-pulse" : ""}`} style={{ color: m.color }} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className={`text-sm font-medium truncate ${m.completedAt ? "line-through text-muted-foreground" : ""}`}>
                        {m.name}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {m.dueAt && (
                          <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                            {new Date(m.dueAt).toLocaleDateString("de-DE")}
                          </span>
                        )}
                        {isOverdue && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1">Überfällig</Badge>
                        )}
                        {m.completedAt && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">Erledigt</Badge>
                        )}
                      </div>
                      {tasksTotal > 0 && (
                        <div className="flex items-center gap-1.5 w-full mt-1">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${taskPct}%`, backgroundColor: taskPct === 100 ? "#10b981" : m.color }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {tasksDone}/{tasksTotal}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                    );
                  })
              )}
            </CardContent>
          </Card>}

          {/* Filament Credit */}
          {isAdmin && customerCredit && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Filament-Guthaben
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Aktuelles Guthaben</span>
                  <span className="font-semibold text-sm">{customerCredit.balance} g</span>
                </div>
                {!showCreditForm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowCreditForm(true)}
                  >
                    Guthaben abziehen
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Menge (g)</label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="z.B. 45"
                        value={creditGrams}
                        onChange={(e) => setCreditGrams(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Grund</label>
                      <Input
                        value={creditReason}
                        onChange={(e) => setCreditReason(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleDeductCredit} disabled={savingCredit}>
                        {savingCredit ? "Buchen..." : "Abziehen"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCreditForm(false)}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Price Estimate */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground">Angebot / Preis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={priceValue}
                  disabled={savingPrice}
                  onChange={(e) => setPriceValue(e.target.value)}
                  onBlur={handleSavePrice}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  €
                </span>
              </div>
              {savingPrice && (
                <p className="text-xs text-muted-foreground">Speichern...</p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground">Aktionen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleToggleArchive}
                disabled={archiving}
              >
                {isArchived ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {archiving ? "Wird wiederhergestellt..." : "Aus Archiv wiederherstellen"}
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 mr-2" />
                    {archiving ? "Wird archiviert..." : "Archivieren"}
                  </>
                )}
              </Button>

              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-xs text-destructive hover:text-destructive hover:bg-destructive/10 opacity-70 hover:opacity-100"
                      disabled={deleting}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      {deleting ? "Wird gelöscht..." : "Dauerhaft löschen"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Auftrag dauerhaft löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Dieser Vorgang kann nicht rückgängig gemacht werden. Der Auftrag von{" "}
                        <strong>{order.customerName}</strong> sowie alle zugehörigen Dateien,
                        Kommentare und der Verlauf werden unwiderruflich gelöscht.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Dauerhaft löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>


          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground">Auftragsinformationen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Erstellt</p>
                <p className="font-medium">{formatDateTime(order.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Aktualisiert</p>
                <p className="font-medium">{formatDateTime(order.updatedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tracking-Link</p>
                <a
                  href={`/track/${order.trackingToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs break-all"
                >
                  /track/{order.trackingToken.slice(0, 16)}...
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Angebotsfreigabe */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Angebotsfreigabe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                {!priceRequest && (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
                {priceRequest?.status === "PENDING" && (
                  <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                    <ShieldAlert className="h-3 w-3" />
                    Ausstehend
                  </span>
                )}
                {priceRequest?.status === "APPROVED" && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Freigegeben</span>
                )}
                {priceRequest?.status === "REJECTED" && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Abgelehnt</span>
                )}
              </div>
              {designApproved && !hasPendingPrice && !priceRequest && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  onClick={() => handleSendVerification("PRICE_APPROVAL")}
                  disabled={sendingVerification}
                >
                  <Send className="h-3 w-3 mr-1" />
                  {sendingVerification ? "Wird gesendet..." : "Freigabe senden"}
                </Button>
              )}
              {!designApproved && !priceRequest && (
                <p className="text-xs text-muted-foreground">Erst nach Designfreigabe verfügbar</p>
              )}
              {hasPendingPrice && isAdmin && priceRequest && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  onClick={() => handleOverrideVerification(priceRequest.id)}
                  disabled={overridingVerification === priceRequest.id}
                >
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  {overridingVerification === priceRequest.id ? "Wird erteilt..." : "Admin-Freigabe erteilen"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Survey */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Umfrage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!order.surveyResponse ? (
                <p className="text-muted-foreground">Noch nicht gesendet</p>
              ) : !order.surveyResponse.submittedAt ? (
                <p className="text-muted-foreground">Gesendet – noch nicht ausgefüllt</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-green-600 font-medium">
                    Eingegangen{" "}
                    {order.surveyResponse.answers && order.surveyResponse.answers.length > 0 && (
                      <span className="ml-1 text-foreground font-normal">
                        ⭐{" "}
                        {(
                          order.surveyResponse.answers.reduce((s, a) => s + a.rating, 0) /
                          order.surveyResponse.answers.length
                        ).toFixed(1)}
                      </span>
                    )}
                  </p>
                  {order.surveyResponse.answers && order.surveyResponse.answers.map((a, i) => (
                    <div key={i} className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">{a.question}</p>
                      <p className="text-xs">{"★".repeat(a.rating)}{"☆".repeat(5 - a.rating)}</p>
                    </div>
                  ))}
                  {order.surveyResponse.comment && (
                    <div className="space-y-0.5 pt-1 border-t">
                      <p className="text-xs text-muted-foreground">Kommentar:</p>
                      <p className="text-xs whitespace-pre-wrap">{order.surveyResponse.comment}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Log */}
          <Card>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => setAuditLogOpen((v) => !v)}
            >
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center justify-between">
                <span>Verlauf</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${auditLogOpen ? "rotate-180" : ""}`}
                />
              </CardTitle>
            </CardHeader>
            {auditLogOpen && (
              <CardContent>
                <ol className="relative border-l border-border space-y-4 ml-3">
                  {order.auditLogs.map((log, idx) => (
                    <li key={log.id} className="ml-5 text-sm">
                      <span className="absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-background border border-border">
                        {idx === 0 ? (
                          <Clock className="h-2 w-2 text-muted-foreground" />
                        ) : (
                          <CheckCircle2 className="h-2 w-2 text-primary" />
                        )}
                      </span>
                      <p className="font-medium">{getActionLabel(log.action)}</p>
                      {log.details && (
                        <p className="text-xs text-muted-foreground">{log.details}</p>
                      )}
                      {log.user && (
                        <p className="text-xs text-muted-foreground">von {log.user.name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <MilestoneDialog
        key={milestoneDialog.milestone?.id ?? "new"}
        open={milestoneDialog.open}
        onOpenChange={(open) => setMilestoneDialog((s) => ({ ...s, open }))}
        orderId={order.id}
        milestone={milestoneDialog.milestone}
        users={teamMembers}
        onSaved={handleMilestoneSaved}
        onDeleted={handleMilestoneDeleted}
        minDate={order.createdAt}
        maxDate={order.deadline}
      />
    </div>
  );
}

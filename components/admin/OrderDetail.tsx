"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { formatDateTime, formatDate, localeToDateLocale } from "@/lib/utils";
import { FileManager } from "@/components/admin/files/FileManager";
import { type OrderPartData } from "@/components/admin/files/PartFileSection";
import type { OrderFileData } from "@/components/admin/files/types";
import {
  Archive,
  ArrowLeft,
  Check,
  Clock,
  Flag,
  Mail,
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
      notes: import("@/components/admin/files/types").NoteData[];
    }>;
    comments: Array<{
      id: string;
      content: string;
      sentToCustomer: boolean;
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
  partPhases: Array<{ id: string; name: string; color: string; isPrintReady: boolean; isReview: boolean; isPrinted: boolean; isMisprint: boolean }>;
  machines: Array<{ id: string; name: string }>;
  buildVolume?: { x: number; y: number; z: number };
  initialMilestones: MilestoneData[];
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}



export function OrderDetail({ order, phases, teamMembers, currentUserId, isAdmin, parts: initialParts, availableFilaments, customerCredit: initialCustomerCredit, partPhases, machines, buildVolume, initialMilestones }: OrderDetailProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = localeToDateLocale(useLocale());
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");

  function getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      ORDER_CREATED: t("audit_submitted"),
      PHASE_CHANGED: t("audit_phase_changed"),
      ASSIGNED: t("audit_assignee_changed"),
      COMMENT_ADDED: t("audit_comment_added"),
      FILE_UPLOADED: t("audit_file_uploaded"),
      TEAM_FILE_UPLOADED: t("audit_team_file"),
      PART_ITERATION_INCREMENTED: t("audit_iteration"),
      ORDER_ARCHIVED: t("audit_archived"),
      ORDER_UNARCHIVED: t("audit_restored"),
      DEADLINE_SET: t("audit_deadline_changed"),
      PRICE_SET: t("audit_price_updated"),
      MATERIAL_ASSIGNED: t("audit_material_assigned"),
      MATERIAL_REMOVED: t("audit_material_removed"),
      SURVEY_SENT: t("audit_survey_sent"),
      SURVEY_SUBMITTED: t("audit_survey_filled"),
      VERIFICATION_SENT: t("audit_verification_sent"),
      VERIFICATION_APPROVED: t("audit_verification_approved"),
      VERIFICATION_REJECTED: t("audit_verification_rejected"),
      VERIFICATION_OVERRIDDEN: t("audit_verification_admin"),
      JOB_ASSIGNED: t("audit_job_assigned"),
      JOB_REMOVED: t("audit_job_removed"),
      JOB_STARTED: t("audit_print_started"),
      JOB_COMPLETED: t("audit_print_done"),
      PART_ADDED: t("audit_part_added"),
      PART_REMOVED: t("audit_part_removed"),
      PART_UPDATED: t("audit_part_updated"),
      PROTOTYPE_ENABLED: t("audit_prototype_on"),
      PROTOTYPE_DISABLED: t("audit_prototype_off"),
      ITERATION_INCREMENTED: t("audit_iteration_inc"),
      CUSTOMER_MESSAGE_SENT: t("audit_customer_message_sent"),
    };
    return labels[action] ?? action;
  }
  const [selectedPhaseId, setSelectedPhaseId] = useState(order.phaseId);
  const [parts, setParts] = useState<OrderPartData[]>(initialParts);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(
    order.assignees.map((a) => a.id)
  );
  const [deadlineValue, setDeadlineValue] = useState(
    order.deadline ? new Date(order.deadline).toISOString().split("T")[0] : ""
  );
  const [comment, setComment] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [comments, setComments] = useState(order.comments);
  const [priceValue, setPriceValue] = useState(
    order.priceEstimate != null ? order.priceEstimate.toFixed(2) : ""
  );
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
  const [sendingCustomerMessage, setSendingCustomerMessage] = useState(false);
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

  type ActivityItem =
    | { kind: "comment"; data: (typeof comments)[0] }
    | { kind: "customer_message"; data: (typeof comments)[0] }
    | { kind: "audit"; data: (typeof order.auditLogs)[0] };

  // Ascending (oldest → newest) for chat-style display
  const allActivityItems = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [
      ...comments.map((c) =>
        c.sentToCustomer
          ? ({ kind: "customer_message", data: c } as ActivityItem)
          : ({ kind: "comment", data: c } as ActivityItem)
      ),
      ...order.auditLogs.map((l) => ({ kind: "audit", data: l } as ActivityItem)),
    ];
    return items.sort(
      (a, b) => new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime()
    );
  }, [comments, order.auditLogs]);

  const allFeedRef = useRef<HTMLDivElement>(null);
  const commentsFeedRef = useRef<HTMLDivElement>(null);
  const historyFeedRef = useRef<HTMLDivElement>(null);
  const customerFeedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom (newest) whenever items are added
  useEffect(() => {
    allFeedRef.current?.scrollTo({ top: allFeedRef.current.scrollHeight, behavior: "instant" });
  }, [allActivityItems.length]);
  useEffect(() => {
    commentsFeedRef.current?.scrollTo({ top: commentsFeedRef.current.scrollHeight, behavior: "instant" });
    customerFeedRef.current?.scrollTo({ top: customerFeedRef.current.scrollHeight, behavior: "instant" });
  }, [comments.length]);
  useEffect(() => {
    historyFeedRef.current?.scrollTo({ top: historyFeedRef.current.scrollHeight, behavior: "instant" });
  }, [order.auditLogs.length]);

  const currentPhase = phases.find((p) => p.id === selectedPhaseId);
  const currentPhaseIsPrototype = !!currentPhase?.isPrototype;

  const designApproved = verificationRequests.some((vr) => vr.type === "DESIGN_REVIEW" && vr.status === "APPROVED");
  const priceRequest = verificationRequests.find((vr) => vr.type === "PRICE_APPROVAL");
  const hasPendingPrice = priceRequest?.status === "PENDING";

  async function handleDeductCredit() {
    if (!customerCredit) return;
    const grams = parseInt(creditGrams, 10);
    if (!grams || grams <= 0) {
      toast.error(t("toast_invalid_grams"));
      return;
    }
    if (!creditReason.trim()) {
      toast.error(t("toast_reason_required"));
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
      toast.success(t("toast_credit_deducted"));
    } catch {
      toast.error(t("toast_credit_failed"));
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
      toast.error(t("toast_update_failed"));
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
        toast.error(data.error ?? t("toast_send_failed"));
        return;
      }
      const newVr = await res.json();
      setVerificationRequests((prev) => [newVr, ...prev]);
      toast.success(t("toast_verification_sent"));
    } catch {
      toast.error(t("toast_send_failed"));
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
      toast.success(t("toast_phase_saved"));
      router.refresh();
    } catch {
      toast.error(t("toast_phase_failed"));
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
      toast.success(t("toast_assignee_saved"));
      router.refresh();
    } catch {
      toast.error(t("toast_phase_failed"));
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
      toast.success(t("toast_deadline_saved"));
      router.refresh();
    } catch {
      toast.error(t("toast_phase_failed"));
    } finally {
      setSavingDeadline(false);
    }
  }


  async function handleSavePrice() {
    if (priceValue === savedPriceValue.current) return;
    const parsed = priceValue.trim() === "" ? null : parseFloat(priceValue.replace(",", "."));
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      toast.error(t("toast_invalid_amount"));
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
      toast.success(t("toast_price_saved"));
      router.refresh();
    } catch {
      toast.error(t("toast_phase_failed"));
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
      toast.success(t("toast_comment_added"));
    } catch {
      toast.error(t("toast_comment_failed"));
    } finally {
      setCommenting(false);
    }
  }

  async function handleSendCustomerMessage() {
    if (!customerMessage.trim()) return;
    setSendingCustomerMessage(true);
    try {
      const res = await fetch("/api/admin/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, content: customerMessage, sentToCustomer: true }),
      });
      if (!res.ok) throw new Error("Send failed");
      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      setCustomerMessage("");
      toast.success(t("toast_comment_added"));
    } catch {
      toast.error(t("toast_comment_failed"));
    } finally {
      setSendingCustomerMessage(false);
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
      toast.error(t("toast_action_failed"));
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
      toast.error(t("toast_action_failed"));
    } finally {
      setTogglingPrototype(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("toast_deleted"));
      router.push("/admin/orders");
    } catch {
      toast.error(t("toast_update_failed"));
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
      toast.success(t("audit_verification_admin"));
      router.refresh();
    } catch {
      toast.error(t("toast_action_failed"));
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
          {t("order_detail_back")}
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
              {t("order_detail_prototype_prefix")}{iterationCount}
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
              <CardTitle className="text-base">{t("order_detail_description")}</CardTitle>
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
            buildVolume={buildVolume}
          />

          {/* Aktivität */}
          <Card>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="font-semibold text-base">{t("order_detail_activity_title")}</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      {comments.filter((c) => !c.sentToCustomer).length} {t("order_detail_comments")}
                    </span>
                  </div>
                  <TabsList className="bg-transparent h-auto p-0 gap-0.5 shrink-0">
                    {(["all", "comments", "history", "customer"] as const).map((v) => (
                      <TabsTrigger
                        key={v}
                        value={v}
                        className="rounded-full px-3 py-1 text-sm font-medium h-auto shadow-none data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none"
                      >
                        {v === "all" ? t("order_detail_activity_all")
                          : v === "comments" ? t("order_detail_comments")
                          : v === "history" ? t("order_detail_history")
                          : t("order_detail_activity_customer")}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </CardHeader>

              <Separator />

              {/* Tab: Alle */}
              <TabsContent value="all" className="mt-0 flex flex-col">
                <div ref={allFeedRef} className="max-h-[400px] overflow-y-auto px-6 divide-y divide-border">
                  {allActivityItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">{t("order_detail_no_history")}</p>
                  )}
                  {allActivityItems.map((item) =>
                    item.kind === "audit" ? (
                      <div key={`audit-${item.data.id}`} className="flex gap-3 items-center py-2">
                        <div className="h-8 w-8 flex items-center justify-center shrink-0">
                          <div className="h-5 w-5 rounded-full border border-border flex items-center justify-center">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-snug">
                          {item.data.user && <span className="font-medium text-foreground">{item.data.user.name}</span>}
                          {" "}{getActionLabel(item.data.action)}
                          {item.data.details && <span className="italic"> · {item.data.details}</span>}
                          <span className="ml-2">{formatDate(item.data.createdAt, locale)}</span>
                        </p>
                      </div>
                    ) : (
                      <div key={`comment-${item.data.id}`} className="flex gap-3 py-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                            {getInitials(item.data.author.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm leading-snug">
                            <span className="font-semibold">{item.data.author.name}</span>
                            {" "}
                            <span className="text-muted-foreground">
                              {item.data.sentToCustomer ? t("order_detail_activity_messaged") : t("order_detail_activity_commented")}
                              {" "}{formatDate(item.data.createdAt, locale)}
                            </span>
                            {item.data.sentToCustomer && (
                              <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-2 py-0.5 align-middle">
                                <Mail className="h-3 w-3" />
                                {t("order_detail_customer_message_sent_badge")}
                              </span>
                            )}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{item.data.content}</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
                <Separator />
                <div className="px-6 pt-4 pb-5 space-y-3">
                  <div className="flex gap-3 items-start">
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <Textarea className="flex-1 resize-none text-sm min-h-[80px]" placeholder={t("order_detail_comment_placeholder")}
                      value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddComment(); }} />
                  </div>
                  <div className="flex items-center justify-between pl-11">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
                      <span>@ @mention</span><span>·</span>
                      <KbdGroup><Kbd>⌘</Kbd><Kbd>↩</Kbd></KbdGroup>
                      <span>senden</span>
                    </div>
                    <Button size="sm" onClick={handleAddComment} disabled={!comment.trim() || commenting}>
                      <Send className="h-3 w-3 mr-1.5" />
                      {commenting ? t("order_detail_comment_submitting") : t("order_detail_comment_submit")}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Kommentare */}
              <TabsContent value="comments" className="mt-0 flex flex-col">
                <div ref={commentsFeedRef} className="max-h-[400px] overflow-y-auto px-6 divide-y divide-border">
                  {comments.filter((c) => !c.sentToCustomer).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">{t("order_detail_no_comments")}</p>
                  )}
                  {[...comments].filter((c) => !c.sentToCustomer)
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((c) => (
                      <div key={c.id} className="flex gap-3 py-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                            {getInitials(c.author.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm leading-snug">
                            <span className="font-semibold">{c.author.name}</span>
                            {" "}<span className="text-muted-foreground">{t("order_detail_activity_commented")} {formatDate(c.createdAt, locale)}</span>
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                    ))}
                </div>
                <Separator />
                <div className="px-6 pt-4 pb-5 space-y-3">
                  <div className="flex gap-3 items-start">
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <Textarea className="flex-1 resize-none text-sm min-h-[80px]" placeholder={t("order_detail_comment_placeholder")}
                      value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddComment(); }} />
                  </div>
                  <div className="flex items-center justify-between pl-11">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
                      <span>@ @mention</span><span>·</span>
                      <KbdGroup><Kbd>⌘</Kbd><Kbd>↩</Kbd></KbdGroup>
                      <span>senden</span>
                    </div>
                    <Button size="sm" onClick={handleAddComment} disabled={!comment.trim() || commenting}>
                      <Send className="h-3 w-3 mr-1.5" />
                      {commenting ? t("order_detail_comment_submitting") : t("order_detail_comment_submit")}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Verlauf */}
              <TabsContent value="history" className="mt-0">
                <div ref={historyFeedRef} className="max-h-[400px] overflow-y-auto px-6 py-2 divide-y divide-border">
                  {order.auditLogs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">{t("order_detail_no_history")}</p>
                  )}
                  {[...order.auditLogs].reverse().map((l) => (
                    <div key={l.id} className="flex gap-3 items-center py-2">
                      <div className="h-8 w-8 flex items-center justify-center shrink-0">
                        <div className="h-5 w-5 rounded-full border border-border flex items-center justify-center">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-snug">
                        {l.user && <span className="font-medium text-foreground">{l.user.name}</span>}
                        {" "}{getActionLabel(l.action)}
                        {l.details && <span className="italic"> · {l.details}</span>}
                        <span className="ml-2">{formatDate(l.createdAt, locale)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Tab: Kundenkontakt */}
              <TabsContent value="customer" className="mt-0 flex flex-col">
                <div ref={customerFeedRef} className="max-h-[400px] overflow-y-auto px-6 divide-y divide-border">
                  {comments.filter((c) => c.sentToCustomer).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">{t("order_detail_no_customer_messages")}</p>
                  )}
                  {[...comments].filter((c) => c.sentToCustomer)
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((c) => (
                      <div key={c.id} className="flex gap-3 py-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                            {getInitials(c.author.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm leading-snug">
                            <span className="font-semibold">{c.author.name}</span>
                            {" "}
                            <span className="text-muted-foreground">{t("order_detail_activity_messaged")} {formatDate(c.createdAt, locale)}</span>
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-2 py-0.5 align-middle">
                              <Mail className="h-3 w-3" />
                              {t("order_detail_customer_message_sent_badge")}
                            </span>
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                    ))}
                </div>
                <Separator />
                <div className="px-6 pt-4 pb-5 space-y-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3 w-3 shrink-0" />
                    {t("order_detail_customer_message_hint", { email: order.customerEmail })}
                  </p>
                  <div className="flex gap-3 items-start">
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <Textarea className="flex-1 resize-none text-sm min-h-[80px]" placeholder={t("order_detail_customer_message_placeholder")}
                      value={customerMessage} onChange={(e) => setCustomerMessage(e.target.value)} rows={3}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSendCustomerMessage(); }} />
                  </div>
                  <div className="flex items-center justify-between pl-11">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
                      <span>@ @mention</span><span>·</span>
                      <KbdGroup><Kbd>⌘</Kbd><Kbd>↩</Kbd></KbdGroup>
                      <span>senden</span>
                    </div>
                    <Button size="sm" onClick={handleSendCustomerMessage} disabled={!customerMessage.trim() || sendingCustomerMessage}>
                      <Send className="h-3 w-3 mr-1.5" />
                      {sendingCustomerMessage ? t("order_detail_customer_message_submitting") : t("order_detail_customer_message_submit")}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status, Assignment & Deadline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground">{t("order_detail_control")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("order_detail_phase")}</label>
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
                <label className="text-sm font-medium">{t("order_detail_assignee")}</label>
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
                <p className="text-xs text-muted-foreground text-center">{tc("saving")}</p>
              )}

              {currentPhaseIsPrototype && (
                <div className="space-y-1 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-purple-600" />
                      {t("order_detail_prototype_mode")}
                    </label>
                    <Switch
                      checked={isPrototype}
                      onCheckedChange={handleTogglePrototype}
                      disabled={togglingPrototype}
                    />
                  </div>
                  {isPrototype && (
                    <p className="text-xs text-purple-600 font-medium">{t("order_detail_iteration")}{iterationCount}</p>
                  )}
                </div>
              )}
              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("order_detail_deadline")}</label>
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
                  <p className="text-xs text-muted-foreground">{tc("saving")}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {t("order_detail_deadline_hint")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Project link */}
          {order.project && (
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t("order_detail_project")}</span>
                  <Link
                    href={`/admin/projects/${order.project.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {order.project.name}
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("order_detail_milestones_managed")}
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
                  {t("order_detail_milestones")} ({milestones.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setMilestoneDialog({ open: true, milestone: null })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {tc("new")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0">
              {milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("order_detail_no_milestones")}</p>
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
                      title={m.completedAt ? t("order_detail_mark_open") : t("order_detail_mark_done")}
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
                          <Badge variant="destructive" className="text-[10px] h-4 px-1">{tc("overdue")}</Badge>
                        )}
                        {m.completedAt && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">{tc("done")}</Badge>
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
                  {t("order_detail_credit")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("order_detail_credit_balance")}</span>
                  <span className="font-semibold text-sm">{customerCredit.balance} g</span>
                </div>
                {!showCreditForm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowCreditForm(true)}
                  >
                    {t("order_detail_credit_deduct")}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">{t("order_detail_credit_amount")}</label>
                      <Input
                        type="number"
                        min="1"
                        placeholder={t("order_detail_credit_amount_placeholder")}
                        value={creditGrams}
                        onChange={(e) => setCreditGrams(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">{t("order_detail_credit_reason")}</label>
                      <Input
                        value={creditReason}
                        onChange={(e) => setCreditReason(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleDeductCredit} disabled={savingCredit}>
                        {savingCredit ? t("order_detail_credit_deducting") : t("order_detail_credit_deduct_cta")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCreditForm(false)}
                      >
                        {tc("cancel")}
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
              <CardTitle className="text-sm font-semibold text-muted-foreground">{t("order_detail_price")}</CardTitle>
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
              <CardTitle className="text-sm font-semibold text-muted-foreground">{t("order_detail_actions")}</CardTitle>
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
                    {archiving ? t("order_detail_restoring") : t("order_detail_restore")}
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 mr-2" />
                    {archiving ? t("order_detail_archiving") : t("order_detail_archive")}
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
                      {deleting ? t("order_detail_deleting") : t("order_detail_delete")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("order_detail_delete_confirm_title")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("order_detail_delete_confirm_desc", { name: order.customerName })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t("order_detail_delete")}
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
              <CardTitle className="text-sm font-semibold text-muted-foreground">{t("order_detail_info")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">{t("order_detail_created")}</p>
                <p className="font-medium">{formatDateTime(order.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("order_detail_updated")}</p>
                <p className="font-medium">{formatDateTime(order.updatedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("order_detail_tracking")}</p>
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
                {t("order_detail_verification_status")}
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
                    {t("order_detail_pending")}
                  </span>
                )}
                {priceRequest?.status === "APPROVED" && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">{t("order_detail_approved")}</span>
                )}
                {priceRequest?.status === "REJECTED" && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">{t("order_detail_rejected")}</span>
                )}
              </div>
              {designApproved && !hasPendingPrice && !priceRequest && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  data-tutorial="send-verification"
                  onClick={() => handleSendVerification("PRICE_APPROVAL")}
                  disabled={sendingVerification}
                >
                  <Send className="h-3 w-3 mr-1" />
                  {sendingVerification ? tc("sending") : tc("send")}
                </Button>
              )}
              {!designApproved && !priceRequest && (
                <p className="text-xs text-muted-foreground">{t("order_detail_design_first")}</p>
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
                  {overridingVerification === priceRequest.id ? t("order_detail_admin_approving") : t("order_detail_admin_approve")}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Survey */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t("order_detail_survey")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!order.surveyResponse ? (
                <p className="text-muted-foreground">{t("order_detail_survey_not_sent")}</p>
              ) : !order.surveyResponse.submittedAt ? (
                <p className="text-muted-foreground">{t("order_detail_survey_sent")}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-green-600 font-medium">
                    {t("order_detail_survey_received")}{" "}
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
                      <p className="text-xs text-muted-foreground">{t("order_detail_comment_prefix")}</p>
                      <p className="text-xs whitespace-pre-wrap">{order.surveyResponse.comment}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
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

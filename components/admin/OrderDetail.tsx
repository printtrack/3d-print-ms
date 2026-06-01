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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { formatDate, localeToDateLocale } from "@/lib/utils";
import { FileManager } from "@/components/admin/files/FileManager";
import { type OrderPartData } from "@/components/admin/files/PartFileSection";
import type { OrderFileData } from "@/components/admin/files/types";
import { QuoteEditor } from "@/components/admin/QuoteEditor";
import { InvoiceCard, type InvoiceUI } from "@/components/admin/InvoiceCard";
import { OrderHeaderMinimal } from "@/components/admin/OrderHeaderMinimal";
import {
  Clock,
  ExternalLink,
  Link2,
  Mail,
  MessageSquare,
  Send,
  ShieldAlert,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { RoadmapStrip, type SprintUI } from "@/components/admin/RoadmapStrip";
import Link from "next/link";


interface FilamentOption {
  id: string;
  name: string;
  material: string;
  color: string;
  colorHex: string | null;
  brand: string | null;
  remainingGrams: number;
  reservedGrams: number;
  availableGrams: number;
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
    orderType: "PRINT_ONLY" | "DESIGN";
    sourceLinks: Array<{ id: string; url: string; label: string | null }>;
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
      quoteId?: string | null;
      rejectionReason?: string | null;
    }>;
    quotes?: import("@/components/admin/QuoteEditor").QuoteUI[];
    invoices?: InvoiceUI[];
  };
  phases: Array<{ id: string; name: string; color: string; isPrototype?: boolean }>;
  teamMembers: Array<{ id: string; name: string; email: string }>;
  currentUserId: string;
  isAdmin: boolean;
  parts: OrderPartData[];
  availableFilaments: FilamentOption[];
  customerCredit: { id: string; balanceCents: number } | null;
  partPhases: Array<{ id: string; name: string; color: string; isPrintReady: boolean; isReview: boolean; isPrinted: boolean; isMisprint: boolean }>;
  machines: Array<{ id: string; name: string }>;
  buildVolume?: { x: number; y: number; z: number };
  initialSprints: SprintUI[];
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}



export function OrderDetail({ order, phases, teamMembers, currentUserId, isAdmin, parts: initialParts, availableFilaments, customerCredit: initialCustomerCredit, partPhases, machines, buildVolume, initialSprints }: OrderDetailProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const rawLocale = useLocale();
  const locale = localeToDateLocale(rawLocale);
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
      QUOTE_CREATED: t("audit_quote_created"),
      QUOTE_UPDATED: t("audit_quote_updated"),
      QUOTE_SENT: t("audit_quote_sent"),
      QUOTE_DELETED: t("audit_quote_deleted"),
      INVOICE_DRAFT_CREATED: t("audit_invoice_draft_created"),
      INVOICE_ISSUED: t("audit_invoice_issued"),
      INVOICE_CANCELLED: t("audit_invoice_cancelled"),
      PAYMENT_RECORDED: t("audit_payment_recorded"),
      PAYMENT_REMOVED: t("audit_payment_removed"),
      REMINDER_SENT: t("audit_reminder_sent"),
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
  const [savingPhase, setSavingPhase] = useState(false);
  const [savingAssignees, setSavingAssignees] = useState(false);
  const [savingDeadline, setSavingDeadline] = useState(false);
  const savedAssigneeIds = useRef<string[]>(order.assignees.map((a) => a.id));
  const savedDeadlineValue = useRef(
    order.deadline ? new Date(order.deadline).toISOString().split("T")[0] : ""
  );
  const [commenting, setCommenting] = useState(false);
  const [sendingCustomerMessage, setSendingCustomerMessage] = useState(false);
  const [isPrototype, setIsPrototype] = useState(order.isPrototype);
  const [iterationCount, setIterationCount] = useState(order.iterationCount);
  const [togglingPrototype, setTogglingPrototype] = useState(false);
  const [orderType, setOrderType] = useState<"PRINT_ONLY" | "DESIGN">(order.orderType);
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
  const [creditEuros, setCreditEuros] = useState("");
  const [creditReason, setCreditReason] = useState(
    `Abzug für Auftrag vom ${new Date(order.createdAt).toLocaleDateString("de-DE")}`
  );
  const [savingCredit, setSavingCredit] = useState(false);

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
    const euros = parseFloat(creditEuros);
    if (!euros || euros <= 0) {
      toast.error(t("toast_invalid_amount"));
      return;
    }
    if (!creditReason.trim()) {
      toast.error(t("toast_reason_required"));
      return;
    }
    const amountCents = -Math.round(euros * 100);
    setSavingCredit(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerCredit.id}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, reason: creditReason.trim(), orderId: order.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Fehler");
        return;
      }
      setCustomerCredit((prev) => prev ? { ...prev, balanceCents: prev.balanceCents + amountCents } : prev);
      setShowCreditForm(false);
      toast.success(t("toast_credit_deducted"));
    } catch {
      toast.error(t("toast_credit_failed"));
    } finally {
      setSavingCredit(false);
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

  async function handleSavePhase(phaseId: string, opts: { override?: boolean } = {}) {
    const previousPhaseId = selectedPhaseId;
    setSelectedPhaseId(phaseId);
    setSavingPhase(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phaseId,
          ...(opts.override ? { quoteGateOverride: true } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.code === "QUOTE_GATE" && err.requiresOverride) {
          setSelectedPhaseId(previousPhaseId);
          if (window.confirm(`${err.error}\n\n${t("quote_gate_override")}?`)) {
            await handleSavePhase(phaseId, { override: true });
            return;
          }
          return;
        }
        throw new Error(err.error ?? "Phase change failed");
      }
      toast.success(t("toast_phase_saved"));
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("toast_phase_failed");
      toast.error(msg);
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

  async function handleOrderTypeChange(next: "PRINT_ONLY" | "DESIGN") {
    if (next === orderType) return;
    const prev = orderType;
    setOrderType(next);

    // Only the PATCH itself decides success/failure. Anything after a 2xx
    // response (toast, router.refresh) must never roll back the UI or raise a
    // failure toast — otherwise a harmless post-success hiccup looks like the
    // save failed even though the change was persisted.
    let res: Response;
    try {
      res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderType: next }),
      });
    } catch {
      setOrderType(prev);
      toast.error(t("toast_action_failed"));
      return;
    }

    if (!res.ok) {
      setOrderType(prev);
      toast.error(t("toast_action_failed"));
      return;
    }

    toast.success(next === "PRINT_ONLY" ? t("order_type_print") : t("order_type_design"));
    router.refresh();
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
    <div className="w-full">
      <OrderHeaderMinimal
        orderId={order.id}
        trackingToken={order.trackingToken}
        customerName={order.customerName}
        customerEmail={order.customerEmail}
        deadline={order.deadline}
        isPrototype={isPrototype}
        iterationCount={iterationCount}
        currentPhaseIsPrototype={currentPhaseIsPrototype}
        onTogglePrototype={handleTogglePrototype}
        togglingPrototype={togglingPrototype}
        orderType={orderType}
        onOrderTypeChange={handleOrderTypeChange}
        phases={phases}
        selectedPhaseId={selectedPhaseId}
        onPhaseChange={handleSavePhase}
        onDeadlineChange={async (iso) => {
          const value = iso ? iso.split("T")[0] : "";
          setDeadlineValue(value);
          await handleSaveDeadline(value);
        }}
        assigneeIds={selectedAssigneeIds}
        onAssigneesChange={async (ids) => {
          setSelectedAssigneeIds(ids);
          await handleSaveAssignees(ids);
        }}
        teamMembers={teamMembers}
        isArchived={isArchived}
        archiving={archiving}
        onToggleArchive={handleToggleArchive}
        isAdmin={isAdmin}
        deleting={deleting}
        onDelete={handleDelete}
      />

      <div className="mx-auto max-w-5xl pt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("order_detail_description")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm whitespace-pre-wrap">{order.description}</p>

              {orderType === "PRINT_ONLY" && order.sourceLinks.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" />
                    {t("order_detail_source_links")}
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {order.sourceLinks.map((link) => (
                      <li key={link.id}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-foreground/30 hover:bg-accent"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{link.label || link.url}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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

          {/* Roadmap with sprints — only shown for orders not in a project */}
          {!order.project && (
            <RoadmapStrip
              orderId={order.id}
              initialSprints={initialSprints}
              minDate={order.createdAt}
              maxDate={order.deadline}
              locale={rawLocale === "en" ? "en" : "de"}
            />
          )}

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
                  <span className="font-semibold text-sm">{(customerCredit.balanceCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
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
                      <label className="text-xs font-medium">{t("customer_credit_amount_eur")}</label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="z.B. 5.00"
                        value={creditEuros}
                        onChange={(e) => setCreditEuros(e.target.value)}
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

          {/* Quote editor */}
          <QuoteEditor
            orderId={order.id}
            initialQuotes={order.quotes ?? []}
            onChanged={() => router.refresh()}
          />

          {/* Invoice card */}
          <InvoiceCard
            orderId={order.id}
            customerCreditCents={customerCredit?.balanceCents ?? null}
            invoices={order.invoices ?? []}
            approvedQuote={(() => {
              const aq = (order.quotes ?? []).find((q) => q.status === "APPROVED");
              return aq
                ? {
                    id: aq.id,
                    number: aq.number ?? null,
                    status: aq.status,
                    totalCents: aq.totalCents,
                    items: aq.items.map((it) => ({
                      id: it.id,
                      description: it.description,
                      quantity: it.quantity,
                      unitPriceCents: it.unitPriceCents,
                      taxRatePercent: it.taxRatePercent,
                      source: it.source,
                      category: it.category,
                    })),
                  }
                : null;
            })()}
            onChanged={() => router.refresh()}
          />

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

    </div>
  );
}

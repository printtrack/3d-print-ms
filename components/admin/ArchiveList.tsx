"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { RotateCcw, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ArchiveOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  archivedAt: string | null;
  phase: { id: string; name: string; color: string };
}

interface ArchiveListProps {
  orders: ArchiveOrder[];
  isAdmin: boolean;
}

export function ArchiveList({ orders, isAdmin }: ArchiveListProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  async function handleRestore(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: false }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("archive_restored"));
      router.refresh();
    } catch {
      toast.error(t("archive_restore_failed"));
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("archive_delete_confirm"))) return;
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("archive_deleted"));
      router.refresh();
    } catch {
      toast.error(t("archive_delete_failed"));
    } finally {
      setLoadingId(null);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground">{t("archive_no_orders")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="hidden md:table w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            <th className="text-left px-4 py-3 font-medium">{t("archive_customer")}</th>
            <th className="text-left px-4 py-3 font-medium">{tc("email")}</th>
            <th className="text-left px-4 py-3 font-medium">{tc("status")}</th>
            <th className="text-left px-4 py-3 font-medium">{t("archive_archived_at")}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {orders.map((order, i) => (
            <tr
              key={order.id}
              className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
            >
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="hover:underline"
                >
                  {order.customerName}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {order.customerEmail}
              </td>
              <td className="px-4 py-3">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: order.phase.color + "20",
                    color: order.phase.color,
                  }}
                >
                  {order.phase.name}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {order.archivedAt
                  ? new Date(order.archivedAt).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(order.id)}
                    disabled={loadingId === order.id}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {t("archive_restore")}
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(order.id)}
                      disabled={loadingId === order.id}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {tc("delete")}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-border">
        {orders.map((order) => (
          <div key={order.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/admin/orders/${order.id}`} className="font-medium hover:underline">
                {order.customerName}
              </Link>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                style={{
                  backgroundColor: order.phase.color + "20",
                  color: order.phase.color,
                }}
              >
                {order.phase.name}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
            <p className="text-xs text-muted-foreground">
              {order.archivedAt
                ? new Date(order.archivedAt).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : "—"}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestore(order.id)}
                disabled={loadingId === order.id}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                {t("archive_restore")}
              </Button>
              {isAdmin && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(order.id)}
                  disabled={loadingId === order.id}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {tc("delete")}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

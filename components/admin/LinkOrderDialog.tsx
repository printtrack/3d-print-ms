"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search } from "lucide-react";

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  phase: { id: string; name: string; color: string };
  deadline: string | null;
  projectId: string | null;
}

interface LinkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  alreadyLinkedIds: string[];
  onLinked: (order: Order) => void;
}

export function LinkOrderDialog({
  open,
  onOpenChange,
  projectId,
  alreadyLinkedIds,
  onLinked,
}: LinkOrderDialogProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/admin/orders")
      .then((r) => r.json())
      .then((data: Order[]) => {
        // Only show non-archived orders not already in another project
        setOrders(
          data.filter(
            (o) =>
              !alreadyLinkedIds.includes(o.id) &&
              (!o.projectId || o.projectId === projectId)
          )
        );
      })
      .catch(() => toast.error("Fehler beim Laden"))
      .finally(() => setLoading(false));
  }, [open, alreadyLinkedIds, projectId]);

  const filtered = orders.filter(
    (o) =>
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.customerEmail.toLowerCase().includes(search.toLowerCase())
  );

  async function handleLink(orderId: string) {
    setLinking(orderId);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Fehler");
      }
      const linked = await res.json();
      onLinked(linked);
      toast.success("Auftrag verknüpft");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Verknüpfen");
    } finally {
      setLinking(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Auftrag verknüpfen</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Aufträge suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Laden...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Keine verfügbaren Aufträge gefunden
            </p>
          ) : (
            filtered.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{order.customerName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: order.phase.color }}
                    >
                      {order.phase.name}
                    </span>
                    {order.deadline && (
                      <span className="text-xs text-muted-foreground">
                        bis{" "}
                        {new Date(order.deadline).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleLink(order.id)}
                  disabled={linking === order.id}
                  className="shrink-0 ml-3"
                >
                  {linking === order.id ? "..." : "Verknüpfen"}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

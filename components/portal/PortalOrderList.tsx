"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

interface Phase {
  id: string;
  name: string;
  color: string;
}

interface Order {
  id: string;
  trackingToken: string;
  customerName: string;
  description: string;
  createdAt: string;
  deadline: string | null;
  priceEstimate: number | null;
  phase: Phase;
}

export function PortalOrderList({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <Package className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Noch keine Aufträge.</p>
        <Link href="/portal/orders/new">
          <Button variant="outline">Jetzt Auftrag einreichen →</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: order.phase.color }}
                  />
                  <Badge variant="secondary" className="text-xs">
                    {order.phase.name}
                  </Badge>
                  {order.priceEstimate !== null && (
                    <Badge variant="outline" className="text-xs">
                      {order.priceEstimate.toFixed(2)} €
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-foreground line-clamp-2">{order.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Eingereicht: {new Date(order.createdAt).toLocaleDateString("de-DE")}</span>
                  {order.deadline && (
                    <span>Frist: {new Date(order.deadline).toLocaleDateString("de-DE")}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link href={`/portal/orders/${order.id}`}>
                  <Button size="sm">Auftrag ansehen</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

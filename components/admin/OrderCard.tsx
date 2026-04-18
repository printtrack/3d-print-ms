"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import { CalendarClock, Clock, FolderKanban, MessageSquare, Paperclip, ShieldAlert } from "lucide-react";
import Link from "next/link";

interface OrderCardProps {
  order: {
    id: string;
    customerName: string;
    customerEmail: string;
    createdAt: string;
    deadline: string | null;
    phase: { id: string; name: string; color: string };
    assignees: Array<{ id: string; name: string; email: string }>;
    files: Array<{ id: string; filename: string; mimeType: string }>;
    _count: { comments: number };
    priceEstimate: number | null;
    pendingVerification?: boolean;
    isPrototype?: boolean;
    iterationCount?: number;
    project?: { id: string; name: string } | null;
  };
  searchQuery?: string;
}

function highlight(text: string, query?: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function getDeadlineBadge(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  const label = d.toLocaleDateString("de-DE");

  if (diffMs < 0) {
    return (
      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
        <CalendarClock className="h-3 w-3 shrink-0" />{label}
      </span>
    );
  } else if (diffH <= 48) {
    return (
      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
        <CalendarClock className="h-3 w-3 shrink-0" />{label}
      </span>
    );
  } else {
    return (
      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
        <CalendarClock className="h-3 w-3 shrink-0" />{label}
      </span>
    );
  }
}

export function OrderCard({ order, searchQuery }: OrderCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id,
    data: { type: "order" },
  });

  // eslint-disable-next-line react-hooks/purity
  const isOverdue = order.deadline ? new Date(order.deadline).getTime() < Date.now() : false;

  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: "none" as const,
  };

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <div
      id={`order-${order.id}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative border rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30 transition-all overflow-hidden ${isOverdue ? "bg-red-50/40" : "bg-card"}`}
    >
      {/* Phase color accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: order.phase.color }}
      />
      <Link
        href={`/admin/orders/${order.id}`}
        onClick={(e) => e.stopPropagation()}
        className="block p-3 pl-[18px]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="font-semibold text-sm line-clamp-1">{highlight(order.customerName, searchQuery)}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{highlight(order.customerEmail, searchQuery)}</p>

          <div className="flex items-center gap-2 flex-wrap">
            {order.deadline && getDeadlineBadge(order.deadline)}
            {order.priceEstimate != null && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                {order.priceEstimate.toFixed(2)} €
              </span>
            )}
            {order.pendingVerification && (
              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                <ShieldAlert className="h-3 w-3" />
                Freigabe ausstehend
              </span>
            )}
            {order.isPrototype && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                Prototyp · #{order.iterationCount ?? 1}
              </span>
            )}
            {order.project && (
              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                <FolderKanban className="h-3 w-3 shrink-0" />
                {order.project.name}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              {formatDate(order.createdAt)}
            </span>

            <div className="flex items-center gap-2">
              {order.files.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="h-3 w-3" />
                  {order.files.length}
                </span>
              )}
              {order._count.comments > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  {order._count.comments}
                </span>
              )}
              {order.assignees.length > 0 && (
                <div className="flex -space-x-1.5">
                  {order.assignees.slice(0, 3).map((a) => (
                    <Avatar key={a.id} className="h-6 w-6 ring-2 ring-background">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(a.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {order.assignees.length > 3 && (
                    <div className="h-6 w-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center">
                      <span className="text-xs text-muted-foreground font-medium">
                        +{order.assignees.length - 3}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

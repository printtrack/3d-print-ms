"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bug, Lightbulb, ExternalLink, Trash2, MessageSquarePlus } from "lucide-react";
import { formatDateTime, localeToDateLocale } from "@/lib/utils";

type FeedbackStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";

interface FeedbackItem {
  id: string;
  type: "BUG" | "IMPROVEMENT";
  title: string;
  description: string;
  screenshotPath: string | null;
  pageUrl: string | null;
  status: FeedbackStatus;
  githubIssueUrl: string | null;
  githubIssueNumber: number | null;
  reporter: string | null;
  createdAt: string;
}

const STATUS_VARIANT: Record<FeedbackStatus, "default" | "secondary" | "outline"> = {
  NEW: "default",
  IN_PROGRESS: "secondary",
  RESOLVED: "outline",
  DISMISSED: "outline",
};

const STATUSES: FeedbackStatus[] = ["NEW", "IN_PROGRESS", "RESOLVED", "DISMISSED"];

export function FeedbackManager({ initialItems }: { initialItems: FeedbackItem[] }) {
  const t = useTranslations("feedback");
  const locale = localeToDateLocale(useLocale());
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<FeedbackStatus | "ALL">("ALL");

  const visible = filter === "ALL" ? items : items.filter((i) => i.status === filter);

  async function setStatus(id: string, status: FeedbackStatus) {
    const prev = items;
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, status } : i)));
    const res = await fetch(`/api/admin/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setItems(prev);
      toast.error(t("error"));
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("confirm_delete"))) return;
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    const res = await fetch(`/api/admin/feedback/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setItems(prev);
      toast.error(t("error"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t("admin_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin_subtitle")}</p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FeedbackStatus | "ALL")}>
          <SelectTrigger className="w-44" data-testid="feedback-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("filter_all")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{t(`status_${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <MessageSquarePlus className="h-8 w-8" />
            <p>{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="feedback-list">
          {visible.map((item) => (
            <Card key={item.id} data-testid="feedback-item">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    {item.type === "BUG" ? (
                      <Bug className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    ) : (
                      <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    )}
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(`type_${item.type === "BUG" ? "bug" : "improvement"}`)} ·{" "}
                        {item.reporter ?? t("anonymous")} · {formatDateTime(item.createdAt, locale)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[item.status]}>{t(`status_${item.status}`)}</Badge>
                </div>

                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>

                {item.pageUrl && (
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-medium">{t("field_page")}:</span> {item.pageUrl}
                  </p>
                )}

                {item.screenshotPath && (
                  <a href={item.screenshotPath} target="_blank" rel="noopener noreferrer" className="block">
                    <Image
                      src={item.screenshotPath}
                      alt={item.title}
                      width={640}
                      height={360}
                      className="max-h-64 w-auto rounded-md border"
                      unoptimized
                    />
                  </a>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={item.status} onValueChange={(v) => setStatus(item.id, v as FeedbackStatus)}>
                    <SelectTrigger className="w-40" data-testid="feedback-status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{t(`status_${s}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {item.githubIssueUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={item.githubIssueUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        {t("issue")} #{item.githubIssueNumber}
                      </a>
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive"
                    onClick={() => remove(item.id)}
                    data-testid="feedback-delete"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {t("delete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

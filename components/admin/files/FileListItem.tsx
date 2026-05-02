"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { FileText, Image as ImageIcon, Download, Trash2, FolderInput } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { is3DModel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type OrderFileData, type FileCategory } from "./types";

const ModelViewer = dynamic(
  () => import("@/components/ModelViewer").then((m) => m.ModelViewer),
  {
    ssr: false,
    loading: () => <div className="w-full h-64 rounded-lg bg-muted animate-pulse" />,
  }
);

interface FileListItemProps {
  file: OrderFileData;
  orderId: string;
  partNameById: Record<string, string>;
  isAdmin: boolean;
  /** Whether this is the current (latest) version in the group */
  isCurrent: boolean;
  onRecategorize: (fileId: string, category: FileCategory) => void;
  onDelete: (fileId: string) => void;
  onMove: (fileId: string, orderPartId: string | null) => void;
  moveTargets: Array<{ id: string; name: string }>;
  currentPartId: string | null;
  onPreview: (url: string) => void;
}

export function FileListItem({
  file,
  orderId,
  partNameById,
  isAdmin,
  isCurrent,
  onRecategorize,
  onDelete,
  onMove,
  moveTargets,
  currentPartId,
  onPreview,
}: FileListItemProps) {
  const fileUrl = `/api/files/${orderId}/${file.filename}`;

  return (
    <div className={cn("space-y-2", !isCurrent && "ml-4 mt-2")}>
      <div className="flex items-center gap-2 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 truncate font-medium">{file.originalName}</span>
        {isCurrent && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase tracking-wide shrink-0">
            Aktuell
          </span>
        )}
        {file.orderPartId && partNameById[file.orderPartId] && file.orderPartId !== currentPartId && (
          <span className="text-xs text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded">
            {partNameById[file.orderPartId]}
          </span>
        )}
        {file.source === "TEAM" && (
          <Badge variant="secondary" className="text-xs shrink-0">
            Team
          </Badge>
        )}
        <a
          href={fileUrl}
          download={file.originalName}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Herunterladen"
        >
          <Download className="h-4 w-4" />
        </a>
        {isAdmin && (
          <>
            <Select
              value={file.category}
              onValueChange={(v) => onRecategorize(file.id, v as FileCategory)}
            >
              <SelectTrigger className="h-6 w-28 text-xs px-2 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as FileCategory[]).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(moveTargets.length > 0 || currentPartId !== null) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                    title="Zu Teil verschieben"
                  >
                    <FolderInput className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {moveTargets
                    .filter((t) => t.id !== currentPartId)
                    .map((t) => (
                      <DropdownMenuItem
                        key={t.id}
                        onClick={() => onMove(file.id, t.id)}
                      >
                        {t.name}
                      </DropdownMenuItem>
                    ))}
                  {currentPartId !== null && (
                    <>
                      {moveTargets.filter((t) => t.id !== currentPartId).length > 0 && (
                        <DropdownMenuSeparator />
                      )}
                      <DropdownMenuItem
                        onClick={() => onMove(file.id, null)}
                        className="text-muted-foreground"
                      >
                        Ohne Teil
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              type="button"
              onClick={() => onDelete(file.id)}
              className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
              title="Datei löschen"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {file.mimeType.startsWith("image/") && (
        <div
          className="relative aspect-video rounded-lg overflow-hidden bg-muted group w-full max-w-sm cursor-pointer"
          onClick={() => onPreview(fileUrl)}
        >
          <Image src={fileUrl} alt={file.originalName} fill className="object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <ImageIcon className="h-6 w-6 text-white" />
          </div>
        </div>
      )}
      {is3DModel(file.filename) && (
        <ModelViewer url={fileUrl} filename={file.filename} />
      )}
    </div>
  );
}

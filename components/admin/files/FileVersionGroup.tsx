"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileListItem } from "./FileListItem";
import type { OrderFileData, FileCategory } from "./types";

interface FileVersionGroupProps {
  groupKey: string;
  files: OrderFileData[];
  orderId: string;
  partNameById: Record<string, string>;
  isAdmin: boolean;
  isExpanded: boolean;
  onToggleExpand: (groupKey: string) => void;
  onRecategorize: (fileId: string, category: FileCategory) => void;
  onDelete: (fileId: string) => void;
  onMove: (fileId: string, orderPartId: string | null) => void;
  moveTargets: Array<{ id: string; name: string }>;
  currentPartId: string | null;
  onPreview: (url: string) => void;
}

export function FileVersionGroup({
  groupKey,
  files,
  orderId,
  partNameById,
  isAdmin,
  isExpanded,
  onToggleExpand,
  onRecategorize,
  onDelete,
  onMove,
  moveTargets,
  currentPartId,
  onPreview,
}: FileVersionGroupProps) {
  const current = files[0];
  const older = files.slice(1);

  const hasVersions = older.length > 0;

  return (
    <div
      className={cn(
        "rounded-lg space-y-2",
        hasVersions ? "border p-3 bg-card" : "px-1 py-1"
      )}
    >
      <FileListItem
        file={current}
        orderId={orderId}
        partNameById={partNameById}
        isAdmin={isAdmin}
        isCurrent={true}
        onRecategorize={onRecategorize}
        onDelete={onDelete}
        onMove={onMove}
        moveTargets={moveTargets}
        currentPartId={currentPartId}
        onPreview={onPreview}
      />
      {older.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => onToggleExpand(groupKey)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-6 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Frühere Versionen ({older.length})
          </button>
          {isExpanded && (
            <div className="space-y-3 border-l pl-3 ml-2">
              {older.map((f) => (
                <FileListItem
                  key={f.id}
                  file={f}
                  orderId={orderId}
                  partNameById={partNameById}
                  isAdmin={isAdmin}
                  isCurrent={false}
                  onRecategorize={onRecategorize}
                  onDelete={onDelete}
                  onMove={onMove}
                  moveTargets={moveTargets}
                  currentPartId={currentPartId}
                  onPreview={onPreview}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

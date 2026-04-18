"use client";

import { Trash2, X, FolderInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CATEGORY_LABELS, type FileCategory } from "./types";

interface BulkFileActionsProps {
  selectedCount: number;
  onRecategorize: (category: FileCategory) => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function BulkFileActions({
  selectedCount,
  onRecategorize,
  onDelete,
  onClearSelection,
}: BulkFileActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
      <span className="text-xs font-semibold text-primary shrink-0">
        {selectedCount} ausgewählt
      </span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <FolderInput className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Select onValueChange={(v) => onRecategorize(v as FileCategory)}>
          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
            <SelectValue placeholder="Verschieben nach…" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(CATEGORY_LABELS) as [FileCategory, string][]).map(
              ([cat, label]) => (
                <SelectItem key={cat} value={cat}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="h-7 text-xs shrink-0 gap-1">
            <Trash2 className="h-3 w-3" />
            Löschen
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedCount} Datei{selectedCount !== 1 ? "en" : ""} löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 shrink-0"
        onClick={onClearSelection}
        title="Auswahl aufheben"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

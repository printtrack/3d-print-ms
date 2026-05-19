"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { NoteData } from "@/components/admin/files/types";

const ModelViewer = dynamic(
  () => import("@/components/ModelViewer").then((m) => m.ModelViewer),
  { ssr: false, loading: () => <div className="w-full h-full bg-muted animate-pulse" /> }
);

export interface CustomerNoteData {
  id: string;
  posX: number;
  posY: number;
  posZ: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  body: string;
  resolvedAt: string | null;
  createdAt: string;
}

export interface OrientationDialogProps {
  orderPartId?: string;
  buildVolume?: { x: number; y: number; z: number };
  initialOrientation?: { qx: number; qy: number; qz: number; qw: number };
  onOrientationSaved?: (q: { qx: number; qy: number; qz: number; qw: number }) => void;
}

interface ModelViewerDialogProps extends OrientationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  fileUrl: string;
  filename: string;
  mode: "admin" | "customer";
  initialNotes: NoteData[] | CustomerNoteData[];
  onNotesChange?: (notes: NoteData[]) => void;
}

export function ModelViewerDialog({
  open,
  onOpenChange,
  fileId,
  fileUrl,
  filename,
  mode,
  initialNotes,
  onNotesChange,
  orderPartId,
  buildVolume,
  initialOrientation,
  onOrientationSaved,
}: ModelViewerDialogProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteData[]>(initialNotes as NoteData[]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [annotationMode, setAnnotationMode] = useState(false);

  // Panel: closed by default for admin, auto-open for customer when notes exist
  const [panelOpen, setPanelOpen] = useState(
    mode === "customer" && initialNotes.length > 0
  );

  const [pendingHit, setPendingHit] = useState<{
    posX: number; posY: number; posZ: number;
    normalX: number; normalY: number; normalZ: number;
  } | null>(null);
  const [pendingBody, setPendingBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const pendingTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Only reset when the dialog opens — NOT when initialNotes changes mid-session.
  // initialNotes changes each time a note is saved (via onNotesChange), which would
  // otherwise close the panel and reset annotation state while the user is working.
  useEffect(() => {
    if (!open) return;
    setNotes(initialNotes as NoteData[]);
    setSelectedNoteId(null);
    setAnnotationMode(false);
    setPendingHit(null);
    setPendingBody("");
    setEditingNoteId(null);
    setPanelOpen(mode === "customer" && (initialNotes as NoteData[]).length > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (pendingHit && pendingTextareaRef.current) {
      pendingTextareaRef.current.focus();
    }
  }, [pendingHit]);

  function toggleAnnotationMode() {
    const next = !annotationMode;
    setAnnotationMode(next);
    if (next) setPanelOpen(true);
    setPendingHit(null);
    setPendingBody("");
  }

  const handleAddNote = useCallback(
    (hit: { posX: number; posY: number; posZ: number; normalX: number; normalY: number; normalZ: number }) => {
      setPendingHit(hit);
      setPendingBody("");
    },
    []
  );

  async function submitNote() {
    if (!pendingHit || !pendingBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/files/${fileId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pendingHit, body: pendingBody.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Notiz konnte nicht gespeichert werden");
        return;
      }
      const created = await res.json();
      const updatedNotes = [...(notes as NoteData[]), created];
      setNotes(updatedNotes);
      onNotesChange?.(updatedNotes);
      setPendingHit(null);
      setPendingBody("");
      setAnnotationMode(false);  // auto-exit annotation mode after saving
      setSelectedNoteId(created.id);
      router.refresh();
    } catch {
      toast.error("Notiz konnte nicht gespeichert werden");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit(note: NoteData) {
    if (!editBody.trim()) return;
    const res = await fetch(`/api/admin/files/${fileId}/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editBody.trim() }),
    });
    if (!res.ok) { toast.error("Fehler beim Speichern"); return; }
    const updated = await res.json();
    setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)));
    setEditingNoteId(null);
  }

  async function deleteNote(note: NoteData) {
    const res = await fetch(`/api/admin/files/${fileId}/notes/${note.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Fehler beim Löschen"); return; }
    const updatedNotes = (notes as NoteData[]).filter((n) => n.id !== note.id);
    setNotes(updatedNotes);
    onNotesChange?.(updatedNotes);
    if (selectedNoteId === note.id) setSelectedNoteId(null);
    router.refresh();
  }

  async function autoSaveOrientation(q: { qx: number; qy: number; qz: number; qw: number }) {
    if (!orderPartId) return;
    try {
      const res = await fetch(`/api/admin/parts/${orderPartId}/orientation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(q),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Orientierung konnte nicht gespeichert werden");
        return;
      }
      toast.success("Orientierung gespeichert");
      onOrientationSaved?.(q);
    } catch {
      toast.error("Orientierung konnte nicht gespeichert werden");
    }
  }

  const viewerNotes = notes.map((n) => ({
    id: n.id,
    posX: n.posX,
    posY: n.posY,
    posZ: n.posZ,
    normalX: n.normalX,
    normalY: n.normalY,
    normalZ: n.normalZ,
    resolved: false,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[95vw] w-[calc(100vw-2rem)] sm:w-[95vw] h-[92vh] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{filename}</DialogTitle>

        {/* Persistent close button — always top-right of entire dialog */}
        <DialogClose asChild>
          <button
            type="button"
            className="absolute top-3 right-3 z-30 flex items-center justify-center w-7 h-7 rounded-md bg-background/80 backdrop-blur border border-border text-foreground hover:bg-muted transition-colors shadow-sm"
            title="Schließen"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </DialogClose>

        <div className="flex h-full">
          {/* Notes Panel — LEFT side, slides in from left */}
          {panelOpen && (
            <div className="w-72 shrink-0 border-r flex flex-col bg-background animate-in slide-in-from-left duration-200">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">
                    Notizen{notes.length > 0 && <span className="ml-1 text-muted-foreground">({notes.length})</span>}
                  </h3>
                  {mode === "admin" && (
                    <button
                      type="button"
                      onClick={toggleAnnotationMode}
                      title={annotationMode ? "Notizmodus beenden" : "Notiz hinzufügen"}
                      className={`flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
                        annotationMode
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setPanelOpen(false); setAnnotationMode(false); setPendingHit(null); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Annotation mode hint inside panel */}
              {annotationMode && !pendingHit && (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b text-xs text-amber-700 dark:text-amber-400">
                  Klicke auf das Modell, um eine Notiz zu setzen.
                </div>
              )}

              {/* Pending note input */}
              {pendingHit && (
                <div className="px-4 py-3 border-b bg-muted/40 space-y-2 shrink-0">
                  <p className="text-xs font-medium">Neue Notiz</p>
                  <Textarea
                    ref={pendingTextareaRef}
                    value={pendingBody}
                    onChange={(e) => setPendingBody(e.target.value)}
                    placeholder="Notiz eingeben…"
                    className="text-sm min-h-[72px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote();
                      if (e.key === "Escape") { setPendingHit(null); setPendingBody(""); }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-7 text-xs" disabled={!pendingBody.trim() || submitting} onClick={submitNote}>
                      {submitting ? "Speichern…" : "Speichern"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setPendingHit(null); setPendingBody(""); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Notes list */}
              <div className="flex-1 overflow-y-auto">
                {notes.length === 0 && !pendingHit && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground p-6 gap-2">
                    {mode === "admin"
                      ? <>"Notiz hinzufügen" klicken und auf das Modell tippen.</>
                      : "Keine Notizen vorhanden."}
                  </div>
                )}
                {notes.map((note, idx) => {
                  const isEditing = editingNoteId === note.id;
                  const isSelected = selectedNoteId === note.id;
                  return (
                    <div
                      key={note.id}
                      data-note-list-id={note.id}
                      className={`px-4 py-3 border-b cursor-pointer transition-colors ${isSelected ? "bg-muted" : "hover:bg-muted/50"}`}
                      onClick={() => {
                        setSelectedNoteId(note.id);
                        setEditingNoteId(null);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        {/* Index dot */}
                        <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white">
                          {idx + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                              <Textarea
                                value={editBody}
                                onChange={(e) => setEditBody(e.target.value)}
                                className="text-xs min-h-[60px] resize-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(note);
                                  if (e.key === "Escape") setEditingNoteId(null);
                                }}
                              />
                              <div className="flex gap-1">
                                <Button size="sm" className="h-6 text-xs flex-1" onClick={() => saveEdit(note)}>Speichern</Button>
                                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingNoteId(null)}>Abbrechen</Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-foreground whitespace-pre-wrap break-words">{note.body}</p>
                          )}

                          {/* Meta */}
                          <div className="mt-1 flex items-center gap-1.5">
                            {"author" in note && note.author && (
                              <span className="text-[10px] text-muted-foreground">{note.author.name}</span>
                            )}
                            <span className="text-[10px] text-muted-foreground">{formatDateTime(note.createdAt)}</span>
                          </div>

                          {/* Admin actions */}
                          {mode === "admin" && !isEditing && (
                            <div className="mt-1.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="Bearbeiten"
                                onClick={() => { setEditingNoteId(note.id); setEditBody(note.body); }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                title="Löschen"
                                onClick={() => deleteNote(note)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3D Viewer — RIGHT side, fills remaining space */}
          <div data-tutorial="viewer-canvas" className={`relative min-w-0 ${panelOpen ? "flex-1" : "w-full"}`}>
            <ModelViewer
              url={fileUrl}
              filename={filename}
              notes={viewerNotes}
              selectedNoteId={selectedNoteId}
              annotationMode={annotationMode}
              onAddNote={mode === "admin" ? handleAddNote : undefined}
              onSelectNote={(id) => {
                setSelectedNoteId(id);
                if (!panelOpen) setPanelOpen(true);
              }}
              buildVolume={buildVolume}
              initialOrientation={initialOrientation}
              orientationEditable={mode === "admin" && !!orderPartId}
              onOrientationChange={orderPartId ? autoSaveOrientation : undefined}
            />

            {/* Filename chip — top left of viewer */}
            <div className="absolute top-3 left-3 pointer-events-none z-20">
              <span className="bg-background/80 backdrop-blur rounded-md px-2 py-1 text-xs font-medium text-foreground">
                {filename}
              </span>
            </div>

            {/* Notes toggle badge — bottom right */}
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              className="absolute bottom-12 right-3 z-20 flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-full px-3 py-1.5 text-xs font-medium shadow border hover:bg-muted transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {notes.length > 0 ? `${notes.length} Notiz${notes.length !== 1 ? "en" : ""}` : "Notizen"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { BookOpen, FileText, Link2, Paperclip, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface KnowledgeFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  entryId: string;
  createdAt: string;
}

interface KnowledgeEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  tags: string[];
  files: KnowledgeFile[];
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string } | null;
}

interface KnowledgeManagerProps {
  initialEntries: KnowledgeEntry[];
  userRole?: string;
}

const emptyForm = { title: "", problem: "", solution: "" };

// Strip markdown image syntax and [[wikilinks]] for plain-text card preview
function stripMarkdown(text: string) {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, "")      // strip image syntax
    .replace(/\[\[([^\]]+)\]\]/g, "$1")   // strip [[Title]] → Title
    .trim();
}

function preprocessWikilinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_, title) =>
    `[${title}](wikilink:${encodeURIComponent(title)})`
  );
}

// Renders plain text with [[Title]] as inline clickable chips
function WikiText({
  text,
  entries,
  onOpen,
}: {
  text: string;
  entries: KnowledgeEntry[];
  onOpen: (e: KnowledgeEntry) => void;
}) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[\[([^\]]+)\]\]$/);
        if (match) {
          const title = match[1];
          const target = entries.find((e) => e.title === title);
          if (target) {
            return (
              <button
                key={i}
                type="button"
                onClick={(ev) => { ev.stopPropagation(); onOpen(target); }}
                className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
              >
                <Link2 className="h-2.5 w-2.5 shrink-0" />
                {title}
              </button>
            );
          }
          return <span key={i} className="opacity-50">{title}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- TagInput component ---
function TagInput({
  value,
  onChange,
  allTags,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  allTags: string[];
}) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    return allTags.filter(
      (t) => !value.includes(t) && (q === "" || t.toLowerCase().includes(q))
    );
  }, [input, value, allTags]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
    inputRef.current?.focus();
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex flex-wrap gap-1.5 min-h-10 px-3 py-2 rounded-md border border-input bg-background text-sm cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded px-2 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? "Tag eingeben und Enter drücken..." : ""}
          className="flex-1 min-w-24 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-1 flex flex-wrap gap-1">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addTag(tag); }}
                className="inline-flex items-center rounded px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function KnowledgeManager({ initialEntries, userRole }: KnowledgeManagerProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm, tags: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [wikilinkQuery, setWikilinkQuery] = useState<string | null>(null);
  const [wikilinkStart, setWikilinkStart] = useState(0);

  // Cursor tracking for "Referenz einfügen"
  const activeFieldRef = useRef<"problem" | "solution">("problem");
  const cursorPosRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const problemRef = useRef<HTMLTextAreaElement>(null);
  const solutionRef = useRef<HTMLTextAreaElement>(null);

  const allTags = useMemo(
    () => Array.from(new Set(entries.flatMap((e) => e.tags))).sort(),
    [entries]
  );

  const isAdmin = userRole === "ADMIN";

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.problem.toLowerCase().includes(q) ||
        e.solution.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [entries, search]);

  function openCreate() {
    setEditingEntry(null);
    setFormData({ ...emptyForm, tags: [] });
    setIsDialogOpen(true);
  }

  function openEdit(entry: KnowledgeEntry) {
    setEditingEntry(entry);
    setFormData({
      title: entry.title,
      problem: entry.problem,
      solution: entry.solution,
      tags: [...entry.tags],
    });
    setIsDialogOpen(true);
  }

  // Track cursor position in textareas
  function trackCursor(field: "problem" | "solution", e: React.SyntheticEvent<HTMLTextAreaElement>) {
    activeFieldRef.current = field;
    cursorPosRef.current = (e.target as HTMLTextAreaElement).selectionStart ?? 0;
  }

  function insertReference(file: KnowledgeFile) {
    if (!editingEntry) return;
    const url = `/api/files/knowledge/${editingEntry.id}/${file.filename}`;
    const snippet = `![${file.originalName}](${url})`;
    const field = activeFieldRef.current;
    const pos = cursorPosRef.current;
    const current = formData[field];
    const newText = current.slice(0, pos) + snippet + current.slice(pos);
    setFormData((p) => ({ ...p, [field]: newText }));
    // Restore focus and move cursor after inserted snippet
    const ref = field === "problem" ? problemRef : solutionRef;
    setTimeout(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        const newPos = pos + snippet.length;
        el.setSelectionRange(newPos, newPos);
        cursorPosRef.current = newPos;
      }
    }, 0);
  }

  function insertWikilink(title: string) {
    const field = activeFieldRef.current;
    const current = formData[field];
    const cursor = cursorPosRef.current;
    const snippet = `[[${title}]]`;
    const newText = current.slice(0, wikilinkStart) + snippet + current.slice(cursor);
    setFormData((p) => ({ ...p, [field]: newText }));
    setWikilinkQuery(null);
    const ref = field === "problem" ? problemRef : solutionRef;
    setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const newPos = wikilinkStart + snippet.length;
      el.focus();
      el.setSelectionRange(newPos, newPos);
      cursorPosRef.current = newPos;
    }, 0);
  }

  async function handleSave() {
    if (!formData.title.trim()) { toast.error("Titel ist erforderlich"); return; }
    if (!formData.problem.trim()) { toast.error("Problem ist erforderlich"); return; }
    if (!formData.solution.trim()) { toast.error("Lösung ist erforderlich"); return; }

    setSaving(true);
    try {
      if (editingEntry) {
        const res = await fetch(`/api/admin/knowledge/${editingEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: formData.title, problem: formData.problem, solution: formData.solution, tags: formData.tags }),
        });
        if (!res.ok) throw new Error();
        const updated: KnowledgeEntry = await res.json();
        // Preserve files from local state (PATCH response already includes files)
        setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        setEditingEntry(updated);
        toast.success("Eintrag aktualisiert");
      } else {
        const res = await fetch("/api/admin/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: formData.title, problem: formData.problem, solution: formData.solution, tags: formData.tags }),
        });
        if (!res.ok) throw new Error();
        const created: KnowledgeEntry = await res.json();
        setEntries((prev) => [created, ...prev]);
        // Transition to edit mode so user can upload files
        setEditingEntry(created);
        toast.success("Eintrag erstellt — du kannst jetzt Anhänge hinzufügen");
      }
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: KnowledgeEntry) {
    if (!confirm(`Eintrag "${entry.title}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/admin/knowledge/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast.success("Eintrag gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!editingEntry || !e.target.files?.length) return;
      const fd = new FormData();
      for (const file of Array.from(e.target.files)) {
        fd.append("files", file);
      }
      setUploading(true);
      try {
        const res = await fetch(`/api/admin/knowledge/${editingEntry.id}/files`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Upload failed");
        }
        const { files: newFiles }: { files: KnowledgeFile[] } = await res.json();
        const serialized = newFiles.map((f) => ({
          ...f,
          createdAt: typeof f.createdAt === "string" ? f.createdAt : new Date(f.createdAt).toISOString(),
        }));
        setEditingEntry((prev) => prev ? { ...prev, files: [...prev.files, ...serialized] } : prev);
        setEntries((prev) =>
          prev.map((e) =>
            e.id === editingEntry.id ? { ...e, files: [...e.files, ...serialized] } : e
          )
        );
        toast.success(`${serialized.length} Datei(en) hochgeladen`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Hochladen");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [editingEntry]
  );

  async function handleFileDelete(file: KnowledgeFile) {
    if (!editingEntry) return;
    if (!confirm(`Datei "${file.originalName}" wirklich löschen?`)) return;
    try {
      const res = await fetch(
        `/api/admin/knowledge/${editingEntry.id}/files/${file.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      setEditingEntry((prev) =>
        prev ? { ...prev, files: prev.files.filter((f) => f.id !== file.id) } : prev
      );
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingEntry.id
            ? { ...e, files: e.files.filter((f) => f.id !== file.id) }
            : e
        )
      );
      toast.success("Datei gelöscht");
    } catch {
      toast.error("Fehler beim Löschen der Datei");
    }
  }

  const currentFiles = editingEntry?.files ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wissensdatenbank</h1>
          <p className="text-muted-foreground text-sm">
            Dokumentiere häufige Probleme und deren Lösungen
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Neu erstellen
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Wissensdatenbank durchsuchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          {entries.length === 0
            ? "Noch keine Einträge vorhanden. Erstelle den ersten Eintrag!"
            : "Keine Einträge für diese Suche gefunden."}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((entry) => (
          <Card key={entry.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-tight">{entry.title}</CardTitle>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(entry)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Problem</p>
                <p className="text-sm line-clamp-2 text-foreground/80"><WikiText text={entry.problem} entries={entries} onOpen={openEdit} /></p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Lösung</p>
                <p className="text-sm line-clamp-2 text-foreground/80"><WikiText text={entry.solution} entries={entries} onOpen={openEdit} /></p>
              </div>
              {entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {entry.author?.name ?? "Unbekannt"} ·{" "}
                  {new Date(entry.updatedAt).toLocaleDateString("de-DE")}
                </p>
                {entry.files.length > 0 && (
                  <span data-testid="attachment-count" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    {entry.files.length}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Eintrag bearbeiten" : "Neuer Eintrag"}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto space-y-4 py-2 pr-1">
            <div className="space-y-2">
              <Label htmlFor="kb-title">Titel *</Label>
              <Input
                id="kb-title"
                placeholder="z.B. Warping bei PETG verhindern"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-problem">Problem *</Label>
              <Textarea
                id="kb-problem"
                ref={problemRef}
                placeholder="Beschreibe das Problem..."
                value={formData.problem}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, problem: e.target.value }));
                  const cursor = e.target.selectionStart ?? 0;
                  cursorPosRef.current = cursor;
                  activeFieldRef.current = "problem";
                  const before = e.target.value.slice(0, cursor);
                  const match = before.match(/\[\[([^\][]*)$/);
                  if (match) {
                    setWikilinkQuery(match[1]);
                    setWikilinkStart(cursor - match[1].length - 2);
                  } else {
                    setWikilinkQuery(null);
                  }
                }}
                onKeyDown={(e) => { if (e.key === "Escape") setWikilinkQuery(null); }}
                onFocus={() => { activeFieldRef.current = "problem"; }}
                onSelect={(e) => trackCursor("problem", e)}
                onClick={(e) => trackCursor("problem", e)}
                rows={4}
              />
              {wikilinkQuery !== null && activeFieldRef.current === "problem" && (() => {
                const matches = entries
                  .filter((e) => editingEntry?.id !== e.id && e.title.toLowerCase().includes(wikilinkQuery.toLowerCase()))
                  .slice(0, 5);
                if (matches.length === 0) return null;
                return (
                  <div className="rounded-md border bg-popover shadow-md z-10">
                    {matches.map((e) => (
                      <button key={e.id} type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                        onMouseDown={(ev) => { ev.preventDefault(); insertWikilink(e.title); }}
                      >
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {e.title}
                      </button>
                    ))}
                  </div>
                );
              })()}
              {editingEntry && formData.problem && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">Vorschau</summary>
                  <div className="mt-2 p-3 rounded border bg-muted/30 prose prose-sm max-w-none">
                    <ReactMarkdown
                      urlTransform={(url) => url}
                      components={{
                        a: ({ href, children }) => {
                          if (href?.startsWith("wikilink:")) {
                            const title = decodeURIComponent(href.slice(9));
                            const target = entries.find((e) => e.title === title);
                            return (
                              <button
                                type="button"
                                onClick={() => target && openEdit(target)}
                                className={[
                                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium no-underline",
                                  target
                                    ? "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-70",
                                ].join(" ")}
                                title={target ? `Öffne: ${title}` : `Eintrag nicht gefunden: ${title}`}
                              >
                                <Link2 className="h-3 w-3 shrink-0" />
                                {children}
                                {!target && <span>?</span>}
                              </button>
                            );
                          }
                          return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
                        },
                      }}
                    >{preprocessWikilinks(formData.problem)}</ReactMarkdown>
                  </div>
                </details>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-solution">Lösung *</Label>
              <Textarea
                id="kb-solution"
                ref={solutionRef}
                placeholder="Beschreibe die Lösung..."
                value={formData.solution}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, solution: e.target.value }));
                  const cursor = e.target.selectionStart ?? 0;
                  cursorPosRef.current = cursor;
                  activeFieldRef.current = "solution";
                  const before = e.target.value.slice(0, cursor);
                  const match = before.match(/\[\[([^\][]*)$/);
                  if (match) {
                    setWikilinkQuery(match[1]);
                    setWikilinkStart(cursor - match[1].length - 2);
                  } else {
                    setWikilinkQuery(null);
                  }
                }}
                onKeyDown={(e) => { if (e.key === "Escape") setWikilinkQuery(null); }}
                onFocus={() => { activeFieldRef.current = "solution"; }}
                onSelect={(e) => trackCursor("solution", e)}
                onClick={(e) => trackCursor("solution", e)}
                rows={4}
              />
              {wikilinkQuery !== null && activeFieldRef.current === "solution" && (() => {
                const matches = entries
                  .filter((e) => editingEntry?.id !== e.id && e.title.toLowerCase().includes(wikilinkQuery.toLowerCase()))
                  .slice(0, 5);
                if (matches.length === 0) return null;
                return (
                  <div className="rounded-md border bg-popover shadow-md z-10">
                    {matches.map((e) => (
                      <button key={e.id} type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                        onMouseDown={(ev) => { ev.preventDefault(); insertWikilink(e.title); }}
                      >
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {e.title}
                      </button>
                    ))}
                  </div>
                );
              })()}
              {editingEntry && formData.solution && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">Vorschau</summary>
                  <div className="mt-2 p-3 rounded border bg-muted/30 prose prose-sm max-w-none">
                    <ReactMarkdown
                      urlTransform={(url) => url}
                      components={{
                        a: ({ href, children }) => {
                          if (href?.startsWith("wikilink:")) {
                            const title = decodeURIComponent(href.slice(9));
                            const target = entries.find((e) => e.title === title);
                            return (
                              <button
                                type="button"
                                onClick={() => target && openEdit(target)}
                                className={[
                                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium no-underline",
                                  target
                                    ? "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-70",
                                ].join(" ")}
                                title={target ? `Öffne: ${title}` : `Eintrag nicht gefunden: ${title}`}
                              >
                                <Link2 className="h-3 w-3 shrink-0" />
                                {children}
                                {!target && <span>?</span>}
                              </button>
                            );
                          }
                          return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
                        },
                      }}
                    >{preprocessWikilinks(formData.solution)}</ReactMarkdown>
                  </div>
                </details>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput
                value={formData.tags}
                onChange={(tags) => setFormData((p) => ({ ...p, tags }))}
                allTags={allTags}
              />
              <p className="text-xs text-muted-foreground">
                Enter oder Komma zum Hinzufügen · Backspace zum Entfernen
              </p>
            </div>

            {/* File attachment section — only shown in edit mode */}
            {editingEntry && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label>Anhänge</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {uploading ? "Hochladen..." : "Datei hochladen"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                {currentFiles.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Noch keine Anhänge. Bilder und PDFs werden unterstützt (max. 20 MB).
                  </p>
                )}

                <div className="space-y-2">
                  {currentFiles.map((file) => {
                    const isImage = file.mimeType.startsWith("image/");
                    const url = `/api/files/knowledge/${editingEntry.id}/${file.filename}`;
                    return (
                      <div
                        key={file.id}
                        data-testid="knowledge-file-row"
                        className="flex items-center gap-3 p-2 rounded-md border bg-muted/20"
                      >
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={file.originalName}
                            className="h-12 w-12 object-cover rounded shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-12 flex items-center justify-center rounded bg-muted shrink-0">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.originalName}</p>
                          <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => insertReference(file)}
                            title="Referenz in Problemfeld oder Lösungsfeld einfügen"
                          >
                            Referenz einfügen
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleFileDelete(file)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!editingEntry && (
              <p className="text-xs text-muted-foreground border-t pt-2">
                Nach dem Speichern können Anhänge hinzugefügt werden.
              </p>
            )}

            {editingEntry && (() => {
              const backlinks = entries.filter(
                (e) => e.id !== editingEntry.id &&
                  (e.problem + e.solution).includes(`[[${editingEntry.title}]]`)
              );
              if (backlinks.length === 0) return null;
              return (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Erwähnt in:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {backlinks.map((e) => (
                      <button key={e.id} type="button" onClick={() => openEdit(e)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted hover:bg-muted/80 text-foreground">
                        <Link2 className="h-3 w-3" />
                        {e.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {editingEntry ? "Schließen" : "Abbrechen"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

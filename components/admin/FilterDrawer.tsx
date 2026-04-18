"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
}

const DEADLINE_OPTIONS = [
  { value: "", label: "Alle" },
  { value: "today", label: "Fällig heute" },
  { value: "week", label: "Diese Woche" },
  { value: "overdue", label: "Überfällig" },
];

function getInitials(name: string | null, email: string) {
  if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return email.slice(0, 2).toUpperCase();
}

export function FilterDrawer({ open, onOpenChange, users }: FilterDrawerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [deadline, setDeadline] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [prototype, setPrototype] = useState(false);
  const [internal, setInternal] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);

  // Sync local state from URL whenever drawer opens
  useEffect(() => {
    if (open) {
      setDeadline(searchParams.get("deadline") ?? "");
      setAssigneeIds(searchParams.get("assigneeId")?.split(",").filter(Boolean) ?? []);
      setPrototype(searchParams.get("prototype") === "true");
      setInternal(searchParams.get("internal") === "true");
      setPendingVerification(searchParams.get("pendingVerification") === "true");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleApply() {
    const params = new URLSearchParams(searchParams.toString());
    if (deadline) params.set("deadline", deadline); else params.delete("deadline");
    if (assigneeIds.length > 0) params.set("assigneeId", assigneeIds.join(",")); else params.delete("assigneeId");
    if (prototype) params.set("prototype", "true"); else params.delete("prototype");
    if (internal) params.set("internal", "true"); else params.delete("internal");
    if (pendingVerification) params.set("pendingVerification", "true"); else params.delete("pendingVerification");
    router.replace(`/admin?${params.toString()}`);
    onOpenChange(false);
  }

  function handleReset() {
    setDeadline("");
    setAssigneeIds([]);
    setPrototype(false);
    setInternal(false);
    setPendingVerification(false);
    const params = new URLSearchParams(searchParams.toString());
    ["deadline", "assigneeId", "prototype", "internal", "pendingVerification"].forEach((k) => params.delete(k));
    router.replace(`/admin?${params.toString()}`);
    onOpenChange(false);
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const localActiveCount =
    (deadline ? 1 : 0) +
    assigneeIds.length +
    (prototype ? 1 : 0) +
    (internal ? 1 : 0) +
    (pendingVerification ? 1 : 0);

  const statusOptions = [
    { checked: prototype, onChange: () => setPrototype((v) => !v), label: "Prototyp" },
    { checked: internal, onChange: () => setInternal((v) => !v), label: "Intern" },
    { checked: pendingVerification, onChange: () => setPendingVerification((v) => !v), label: "Verifikation ausstehend" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">
          {/* Deadline */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Deadline
            </p>
            <div className="flex flex-col gap-0.5">
              {DEADLINE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDeadline(opt.value)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left w-full ${
                    deadline === opt.value
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full flex-shrink-0 transition-colors ${
                      deadline === opt.value ? "bg-primary" : "border border-muted-foreground/40 bg-transparent"
                    }`}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Assignee */}
          {users.length > 0 && (
            <>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Zugewiesen an
                </p>
                <div className="flex flex-col gap-1">
                  {users.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={assigneeIds.includes(user.id)}
                        onCheckedChange={() => toggleAssignee(user.id)}
                      />
                      <Avatar className="h-6 w-6 text-[10px]">
                        <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1 min-w-0 truncate">{user.name ?? user.email}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Status
            </p>
            <div className="flex flex-col gap-1">
              {statusOptions.map(({ checked, onChange, label }) => (
                <label key={label} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={onChange} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="px-5 py-4 border-t flex flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={handleReset}>
            Zurücksetzen
          </Button>
          <Button className="flex-1" onClick={handleApply}>
            Anwenden
            {localActiveCount > 0 && (
              <span className="ml-1 h-4 min-w-4 rounded-full bg-primary-foreground/25 text-[10px] font-semibold px-1 flex items-center justify-center">
                {localActiveCount}
              </span>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

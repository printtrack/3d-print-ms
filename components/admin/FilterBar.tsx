"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { FilterDrawer } from "./FilterDrawer";

interface SearchResult {
  id: string;
  customerName: string;
  customerEmail: string;
  phase: { name: string; color: string };
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface FilterBarProps {
  results?: SearchResult[];
  users: User[];
}

const DEADLINE_LABELS: Record<string, string> = {
  today: "Fällig heute",
  week: "Diese Woche",
  overdue: "Überfällig",
};

export function FilterBar({ results = [], users }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") ?? "");
  const [, startTransition] = useTransition();
  const [dropdownOpen, setDropdownOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDropdownOpen(true); }, [results]);

  const deadline = searchParams.get("deadline") ?? "";
  const assigneeIds = searchParams.get("assigneeId")?.split(",").filter(Boolean) ?? [];
  const prototype = searchParams.get("prototype") === "true";
  const internal = searchParams.get("internal") === "true";
  const pendingVerification = searchParams.get("pendingVerification") === "true";

  const activeFilterCount =
    (deadline ? 1 : 0) +
    assigneeIds.length +
    (prototype ? 1 : 0) +
    (internal ? 1 : 0) +
    (pendingVerification ? 1 : 0);

  function handleSearch(value: string) {
    setQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("search", value); else params.delete("search");
    startTransition(() => router.replace(`/admin/orders?${params.toString()}`));
  }

  function handleItemClick(orderId: string) {
    setDropdownOpen(false);
    setQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    params.set("highlight", orderId);
    startTransition(() => router.replace(`/admin/orders?${params.toString()}`));
  }

  function removeFilter(key: string, value?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "assigneeId" && value) {
      const ids = assigneeIds.filter((id) => id !== value);
      if (ids.length > 0) params.set("assigneeId", ids.join(","));
      else params.delete("assigneeId");
    } else {
      params.delete(key);
    }
    router.replace(`/admin/orders?${params.toString()}`);
  }

  function clearAllFilters() {
    const params = new URLSearchParams(searchParams.toString());
    ["deadline", "assigneeId", "prototype", "internal", "pendingVerification"].forEach((k) => params.delete(k));
    router.replace(`/admin/orders?${params.toString()}`);
  }

  const showDropdown = dropdownOpen && query.length > 0 && results.length > 0;

  const pills: { key: string; value?: string; label: string }[] = [];
  if (deadline) pills.push({ key: "deadline", label: DEADLINE_LABELS[deadline] ?? deadline });
  assigneeIds.forEach((id) => {
    const user = users.find((u) => u.id === id);
    pills.push({ key: "assigneeId", value: id, label: user?.name ?? user?.email ?? id });
  });
  if (prototype) pills.push({ key: "prototype", label: "Prototyp" });
  if (internal) pills.push({ key: "internal", label: "Intern" });
  if (pendingVerification) pills.push({ key: "pendingVerification", label: "Verifikation ausstehend" });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div
          className="relative flex-1 min-w-0 md:w-72 md:flex-none"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropdownOpen(false);
          }}
          tabIndex={-1}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Aufträge suchen..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results.length === 1) handleItemClick(results[0].id);
            }}
            className="pl-9 pr-8"
          />
          {query && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {showDropdown && (
            <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-72 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  tabIndex={0}
                  onClick={() => handleItemClick(r.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent text-sm transition-colors"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.phase.color }} />
                  <span className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{r.customerName}</span>
                    <span className="text-xs text-muted-foreground truncate block">{r.customerEmail}</span>
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{r.phase.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 flex-shrink-0 h-9"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
          {activeFilterCount > 0 && (
            <Badge className="h-4 min-w-4 px-1 text-[10px] rounded-full flex items-center justify-center">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Active filter pills */}
      {pills.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {pills.map((pill) => (
            <Badge
              key={`${pill.key}-${pill.value ?? ""}`}
              variant="secondary"
              className="flex items-center gap-1 pr-1.5 text-xs h-6"
            >
              {pill.label}
              <button
                onClick={() => removeFilter(pill.key, pill.value)}
                className="rounded-sm hover:bg-foreground/10 p-0.5 ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Alle zurücksetzen
          </button>
        </div>
      )}

      <FilterDrawer open={drawerOpen} onOpenChange={setDrawerOpen} users={users} />
    </div>
  );
}

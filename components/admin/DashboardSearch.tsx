"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface SearchResult {
  id: string;
  customerName: string;
  customerEmail: string;
  phase: { name: string; color: string };
}

export function DashboardSearch({ results = [] }: { results?: SearchResult[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") ?? "");
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(true);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOpen(true); }, [results]);

  function handleSearch(value: string) {
    setQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    startTransition(() => {
      router.replace(`/admin?${params.toString()}`);
    });
  }

  function clearSearch() {
    handleSearch("");
  }

  function handleItemClick(orderId: string) {
    setOpen(false);
    setQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    params.set("highlight", orderId);
    startTransition(() => {
      router.replace(`/admin?${params.toString()}`);
    });
  }

  const showDropdown = open && query.length > 0 && results.length > 0;

  return (
    <div
      className="relative w-full md:w-64"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}
      tabIndex={-1}
    >
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Aufträge suchen..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results.length === 1) {
            handleItemClick(results[0].id);
          }
        }}
        className="pl-9 pr-8"
      />
      {query && (
        <button
          onClick={clearSearch}
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
  );
}

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { WikiMeta } from "@/lib/wiki";

interface WikiSidebarProps {
  pages: WikiMeta[];
}

export function WikiSidebar({ pages }: WikiSidebarProps) {
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const t = useTranslations("wiki");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return pages;
    return pages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [pages, query]);

  const groups = useMemo(() => {
    const map = new Map<string, WikiMeta[]>();
    for (const page of filtered) {
      const g = page.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(page);
    }
    return map;
  }, [filtered]);

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search_placeholder")}
          className="pl-8 text-sm h-9"
          data-testid="wiki-search"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground px-1">{t("no_results")}</p>
      )}

      {Array.from(groups.entries()).map(([group, items]) => (
        <div key={group}>
          {group && (
            <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group}
            </p>
          )}
          <ul className="space-y-0.5">
            {items.map((page) => {
              const active = pathname === `/admin/wiki/${page.slug}`;
              return (
                <li key={page.slug}>
                  <Link
                    href={`/admin/wiki/${page.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block px-2 py-1.5 rounded text-sm transition-colors relative",
                      active
                        ? "bg-primary/8 text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                        style={{ backgroundColor: "var(--brand-accent)" }}
                      />
                    )}
                    <span className="pl-1">{page.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}

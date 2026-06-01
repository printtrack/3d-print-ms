"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  SlidersHorizontal,
  Users2,
  LogOut,
  Printer,
  Menu,
  BookOpen,
  Layers,
  CalendarRange,
  FolderKanban,
  LifeBuoy,
  GraduationCap,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTutorial } from "@/lib/tutorial/use-tutorial";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  adminOnly?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface AdminNavProps {
  userRole?: string;
  companyName?: string;
}

export function AdminNav({ userRole, companyName = "3D Print CMS" }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");
  const tutorial = useTutorial();

  const navSections: NavSection[] = [
    {
      label: t("overview"),
      items: [
        { href: "/admin", label: t("dashboard"), icon: LayoutDashboard, exact: true },
      ],
    },
    {
      label: t("orders_production"),
      items: [
        { href: "/admin/orders", label: t("orders"), icon: ClipboardList },
        { href: "/admin/jobs", label: t("print_jobs"), icon: Layers },
        { href: "/admin/projects", label: t("projects"), icon: FolderKanban },
      ],
    },
    {
      label: t("planning_resources"),
      items: [
        { href: "/admin/planning", label: t("planning"), icon: CalendarRange },
        { href: "/admin/inventory", label: t("inventory"), icon: Package },
      ],
    },
    {
      label: t("knowledge_admin"),
      items: [
        { href: "/admin/knowledge", label: t("knowledge"), icon: BookOpen },
        { href: "/admin/customers", label: t("customers"), icon: Users2, adminOnly: true },
        { href: "/admin/settings", label: t("settings"), icon: SlidersHorizontal, adminOnly: true },
      ],
    },
    {
      label: "",
      items: [
        { href: "/admin/wiki", label: t("help"), icon: LifeBuoy },
      ],
    },
  ];

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  const navLinks = (onLinkClick?: () => void) => (
    <>
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border/60">
        <div
          className="flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0"
          style={{ backgroundColor: "oklch(0.72 0.18 55)" }}
        >
          <Printer className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-base leading-tight">{companyName}</span>
      </div>

      <nav aria-label="Admin-Navigation" className="flex-1 px-3 py-4 overflow-y-auto">
        {navSections.map((section, sectionIndex) => {
          const visibleItems = section.items.filter(
            (item) => !item.adminOnly || userRole === "ADMIN",
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className={sectionIndex > 0 ? "pt-3" : ""}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href, item.exact);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onLinkClick}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all relative",
                          active
                            ? "bg-primary/8 text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        {active && (
                          <span
                            className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                            style={{ backgroundColor: "oklch(0.72 0.18 55)" }}
                          />
                        )}
                        <item.icon className={cn("h-4 w-4 flex-shrink-0", active && "text-primary")} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border/60 space-y-1">
        <div className="flex items-center justify-end px-3 py-1">
          <LanguageSwitcher />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={() => {
            // Mark onboarded (not reset) so the tour does not auto-start on the
            // next page load — this is an explicit, user-triggered restart.
            fetch("/api/admin/me/onboarding", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            tutorial.start();
            router.push("/admin/orders?tutorial=1");
          }}
        >
          <GraduationCap className="h-4 w-4" />
          {t("start_tutorial")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        >
          <LogOut className="h-4 w-4" />
          {t("signout")}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-14 bg-card border-b">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={t("open_menu")}>
          <Menu className="h-5 w-5" />
        </Button>
        <span className="font-semibold text-sm">{companyName}</span>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen bg-zinc-50/80 border-r">
        {navLinks()}
      </aside>

      {/* Mobile Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <VisuallyHidden>
            <SheetTitle>Navigation</SheetTitle>
          </VisuallyHidden>
          <div className="flex flex-col h-full">
            {navLinks(() => setOpen(false))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

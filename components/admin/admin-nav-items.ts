// Route hrefs used in AdminNav — coverage test imports this as source of truth.
// Keep in sync with the navSections in AdminNav.tsx.
export const ADMIN_NAV_HREFS = [
  "/admin",
  "/admin/orders",
  "/admin/jobs",
  "/admin/projects",
  "/admin/planning",
  "/admin/inventory",
  "/admin/knowledge",
  "/admin/customers",
  "/admin/settings",
] as const;

// Derive slug from href: "/admin/orders" → "orders", "/admin" → "dashboard"
export function hrefToSlug(href: string): string {
  const segment = href.replace(/^\/admin\/?/, "");
  return segment === "" ? "dashboard" : segment;
}

// Wiki-related routes — excluded from coverage check
export const WIKI_EXEMPT_HREFS = ["/admin/wiki"] as const;

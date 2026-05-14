import { promises as fs } from "fs";
import path from "path";
import matter from "gray-matter";
import type { Locale } from "@/i18n/locale";

export type WikiMeta = {
  slug: string;
  title: string;
  description: string;
  route?: string;
  icon?: string;
  group?: string;
  order?: number;
};

export type WikiPage = WikiMeta & {
  body: string;
  isFallback: boolean;
};

const WIKI_DIR = path.join(process.cwd(), "docs/wiki");

// Production cache: locale:slug → WikiPage | null
const cache = new Map<string, WikiPage | null>();

async function readFile(slug: string, locale: Locale): Promise<string | null> {
  const filePath = path.join(WIKI_DIR, locale, "admin", `${slug}.md`);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function loadPage(slug: string, locale: Locale): Promise<WikiPage | null> {
  const cacheKey = `${locale}:${slug}`;
  if (process.env.NODE_ENV !== "development" && cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  let source = await readFile(slug, locale);
  let isFallback = false;

  if (source === null && locale !== "de") {
    source = await readFile(slug, "de");
    if (source !== null) isFallback = true;
  }

  if (source === null) {
    if (process.env.NODE_ENV !== "development") cache.set(cacheKey, null);
    return null;
  }

  const { data, content } = matter(source);
  const page: WikiPage = {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    route: data.route,
    icon: data.icon,
    group: data.group,
    order: data.order,
    body: content,
    isFallback,
  };

  if (process.env.NODE_ENV !== "development") cache.set(cacheKey, page);
  return page;
}

export async function listWikiPages(locale: Locale): Promise<WikiMeta[]> {
  const dir = path.join(WIKI_DIR, locale, "admin");
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }

  const slugs = files
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => f.replace(/\.md$/, ""));

  const pages = await Promise.all(slugs.map((s) => loadPage(s, locale)));
  return (pages.filter(Boolean) as WikiPage[]).sort(
    (a, b) => (a.order ?? 99) - (b.order ?? 99)
  );
}

export async function getWikiPage(slug: string, locale: Locale): Promise<WikiPage | null> {
  return loadPage(slug, locale);
}

export async function getWikiIndex(locale: Locale): Promise<WikiPage | null> {
  return loadPage("_index", locale);
}

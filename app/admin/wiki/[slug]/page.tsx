import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { getLocale } from "@/i18n/get-locale";
import { getWikiPage, listWikiPages } from "@/lib/wiki";
import { WikiSidebar } from "@/components/admin/wiki/WikiSidebar";
import { WikiMarkdown } from "@/components/admin/wiki/WikiMarkdown";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WikiSlugPage({ params }: Props) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("wiki");
  const [page, pages] = await Promise.all([
    getWikiPage(slug, locale),
    listWikiPages(locale),
  ]);

  if (!page) notFound();

  return (
    <div className="flex gap-8 p-6 flex-1 min-h-0">
      <WikiSidebar pages={pages} />
      <main className="flex-1 min-w-0 overflow-y-auto" data-testid="wiki-content">
        <div className="mb-4">
          <Link
            href="/admin/wiki"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("back_to_overview")}
          </Link>
        </div>

        {page.isFallback && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {t("fallback_banner")}
          </div>
        )}

        <WikiMarkdown body={page.body} pages={pages} />
      </main>
    </div>
  );
}

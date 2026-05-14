import { getTranslations } from "next-intl/server";
import { getLocale } from "@/i18n/get-locale";
import { listWikiPages, getWikiIndex } from "@/lib/wiki";
import { WikiSidebar } from "@/components/admin/wiki/WikiSidebar";
import { WikiMarkdown } from "@/components/admin/wiki/WikiMarkdown";

export default async function WikiIndexPage() {
  const locale = await getLocale();
  const t = await getTranslations("wiki");
  const [pages, index] = await Promise.all([
    listWikiPages(locale),
    getWikiIndex(locale),
  ]);

  return (
    <div className="flex gap-8 p-6 flex-1 min-h-0">
      <WikiSidebar pages={pages} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
        {index ? (
          <WikiMarkdown body={index.body} pages={pages} />
        ) : (
          <p className="text-muted-foreground">Keine Index-Seite gefunden.</p>
        )}
      </main>
    </div>
  );
}

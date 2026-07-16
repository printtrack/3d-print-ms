import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BlockToolbar } from "@/components/landing/edit/BlockToolbar";

/**
 * A row whose data no longer matches its type's schema.
 *
 * The public page drops these silently — one bad row must not take the shop's
 * front page down. But the editor has to show them, or an admin could neither
 * see nor delete a block that exists and is broken. This is the whole reason
 * parseBlock() returns null instead of throwing.
 *
 * Editor-only; never rendered for a visitor.
 */
export async function BrokenBlock({ blockId, type }: { blockId: string; type: string }) {
  const t = await getTranslations("admin");

  return (
    <section
      data-landing-block={blockId}
      data-landing-broken=""
      className="relative border-y border-dashed border-amber-500/40 bg-amber-500/5 py-16"
    >
      <BlockToolbar blockId={blockId} type={type} />
      <div className="container mx-auto flex items-start gap-3 px-6 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="max-w-xl text-amber-900 dark:text-amber-200">{t("landing_block_broken")}</p>
      </div>
    </section>
  );
}

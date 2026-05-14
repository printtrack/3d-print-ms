import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function VerifyErrorPage() {
  const t = await getTranslations("portal");

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h1 className="text-xl font-bold">{t("verify_error_title")}</h1>
      <p className="text-muted-foreground text-sm max-w-sm">
        {t("verify_error_desc")}
      </p>
      <Button asChild>
        <Link href="/portal">{t("verify_error_back")}</Link>
      </Button>
    </div>
  );
}

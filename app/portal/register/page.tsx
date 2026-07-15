import Link from "next/link";
import { Printer, MailQuestion, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getRegistrationMode } from "@/lib/order-intake";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PortalRegisterForm } from "./PortalRegisterForm";

// Mirrors the checks in /api/portal/auth/register so an unusable link says why
// instead of failing on submit. The API stays the authority.
async function resolveInvite(token: string) {
  const invite = await prisma.customerInvite.findUnique({ where: { token } });
  if (!invite) return { valid: false as const, reason: "invalid" as const };
  if (invite.usedAt) return { valid: false as const, reason: "used" as const };
  if (invite.expiresAt < new Date()) return { valid: false as const, reason: "expired" as const };
  return { valid: true as const, email: invite.email };
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-3">
          <Printer className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

function Notice({
  icon: Icon,
  title,
  body,
  t,
}: {
  icon: typeof Lock;
  title: string;
  body: string;
  t: Awaited<ReturnType<typeof getTranslations<"portal">>>;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{body}</p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/portal/signin">{t("register_already_have_cta")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function PortalRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const t = await getTranslations("portal");
  const { invite: inviteToken } = await searchParams;
  const mode = await getRegistrationMode();

  if (mode === "closed") {
    return (
      <Shell title={t("register_title")}>
        <Notice icon={Lock} title={t("register_closed_title")} body={t("register_closed_body")} t={t} />
      </Shell>
    );
  }

  const invite = inviteToken ? await resolveInvite(inviteToken) : null;

  if (mode === "invite" && !invite) {
    return (
      <Shell title={t("register_title")}>
        <Notice
          icon={MailQuestion}
          title={t("register_invite_only_title")}
          body={t("register_invite_only_body")}
          t={t}
        />
      </Shell>
    );
  }

  if (invite && !invite.valid) {
    return (
      <Shell title={t("register_title")}>
        <Notice
          icon={MailQuestion}
          title={t("register_invite_invalid_title")}
          body={t(`register_invite_${invite.reason}_body`)}
          t={t}
        />
      </Shell>
    );
  }

  return (
    <Shell title={t("register_title")}>
      <PortalRegisterForm
        inviteToken={invite?.valid ? inviteToken : undefined}
        // Bound invites fix the address — the field is prefilled and locked.
        inviteEmail={invite?.valid ? invite.email ?? undefined : undefined}
      />
    </Shell>
  );
}

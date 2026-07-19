import Link from "next/link";
import { Printer, MailQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AcceptInviteForm } from "./AcceptInviteForm";

// Mirrors the checks in /api/team-invites/[token]/accept so an unusable link
// says why instead of failing on submit. The API stays the authority.
async function resolveInvite(token: string) {
  const invite = await prisma.teamInvite.findUnique({ where: { token } });
  if (!invite) return { valid: false as const, reason: "invalid" as const };
  if (invite.usedAt) return { valid: false as const, reason: "used" as const };
  if (invite.expiresAt < new Date()) return { valid: false as const, reason: "expired" as const };
  return { valid: true as const, email: invite.email };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "oklch(0.10 0.01 260)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in oklab, var(--brand-accent) 12%, transparent) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 w-full max-w-sm px-4">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div
            className="flex items-center justify-center h-10 w-10 rounded-xl"
            style={{ backgroundColor: "var(--brand-accent)" }}
          >
            <Printer className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">3D Print CMS</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getTranslations("auth");
  const { token } = await searchParams;
  const invite = token ? await resolveInvite(token) : null;

  if (!token || !invite || !invite.valid) {
    const reason = invite && !invite.valid ? invite.reason : "invalid";
    return (
      <Shell>
        <Card>
          <CardContent className="space-y-4 pt-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <MailQuestion className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">{t("accept_invite_invalid_title")}</p>
              <p className="text-sm text-muted-foreground">{t(`accept_invite_${reason}_body`)}</p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/signin">{t("accept_invite_to_signin")}</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <AcceptInviteForm token={token} inviteEmail={invite.email ?? undefined} />
    </Shell>
  );
}

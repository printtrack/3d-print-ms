import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";

// Revoke an invite. Redeemed invites are deleted too — the account already
// exists, the row is only history at that point.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { token } = await params;
  const invite = await prisma.teamInvite.findUnique({ where: { token } });
  if (!invite) return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 });

  await prisma.teamInvite.delete({ where: { token } });
  return NextResponse.json({ success: true });
}

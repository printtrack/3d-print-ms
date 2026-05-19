import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reset } = await req.json().catch(() => ({}));

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardedAt: reset ? null : new Date() },
  });

  return NextResponse.json({ ok: true });
}

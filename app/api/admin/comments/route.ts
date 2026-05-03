import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { publish } from "@/lib/event-bus";

const createSchema = z.object({
  orderId: z.string(),
  content: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const comment = await prisma.orderComment.create({
      data: {
        orderId: data.orderId,
        authorId: session.user.id,
        content: data.content,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        orderId: data.orderId,
        userId: session.user.id,
        action: "COMMENT_ADDED",
        details: `Kommentar von ${session.user.name}`,
      },
    });

    publish({ type: "comment.added", orderId: data.orderId });
    publish({ type: "order.changed", orderId: data.orderId });

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { publish } from "@/lib/event-bus";
import { sendCustomerMessageEmail } from "@/lib/email";

const createSchema = z.object({
  orderId: z.string(),
  content: z.string().min(1),
  sentToCustomer: z.boolean().optional().default(false),
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
        sentToCustomer: data.sentToCustomer,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    if (data.sentToCustomer) {
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        select: { customerEmail: true, customerName: true, trackingToken: true },
      });

      if (order) {
        sendCustomerMessageEmail({
          customerEmail: order.customerEmail,
          customerName: order.customerName,
          trackingToken: order.trackingToken,
          messageBody: data.content,
        }).catch((err) => console.error("[email] sendCustomerMessageEmail failed:", err));
      }

      await prisma.auditLog.create({
        data: {
          orderId: data.orderId,
          userId: session.user.id,
          action: "CUSTOMER_MESSAGE_SENT",
          details: data.content.length > 80 ? data.content.slice(0, 80) + "…" : data.content,
        },
      });
    } else {
      await prisma.auditLog.create({
        data: {
          orderId: data.orderId,
          userId: session.user.id,
          action: "COMMENT_ADDED",
          details: `Kommentar von ${session.user.name}`,
        },
      });
    }

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

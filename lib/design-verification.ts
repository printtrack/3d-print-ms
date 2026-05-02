import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";

/**
 * Auto-sends a per-part DESIGN_REVIEW if not already PENDING.
 * Called when a part transitions to an isReview phase and the order is not prototype.
 */
export async function maybeAutoSendPartDesignVerification(
  orderId: string,
  orderPartId: string
): Promise<void> {
  const existing = await prisma.verificationRequest.findFirst({
    where: { orderId, orderPartId, type: "DESIGN_REVIEW", status: "PENDING" },
  });
  if (existing) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { trackingToken: true, customerName: true, customerEmail: true },
  });
  if (!order) return;

  const vr = await prisma.verificationRequest.create({
    data: { orderId, orderPartId, type: "DESIGN_REVIEW" },
  });

  await prisma.auditLog.create({
    data: {
      orderId,
      userId: null,
      action: "DESIGN_REVIEW_SENT",
      details: `Designfreigabe automatisch versandt für Teil`,
    },
  });

  sendVerificationEmail({
    customerEmail: order.customerEmail,
    customerName: order.customerName,
    verificationToken: vr.token,
    type: "DESIGN_REVIEW",
    trackingToken: order.trackingToken,
  }).catch((err) => console.error("[email] Part design verification email failed:", err));
}

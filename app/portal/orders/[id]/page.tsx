import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCustomerSessionFromCookies } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { PortalOrderDetail } from "@/components/portal/PortalOrderDetail";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalOrderDetailPage({ params }: PageProps) {
  const customer = await getCustomerSessionFromCookies();
  if (!customer) redirect("/portal/signin");

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      phase: true,
      files: true,
      auditLogs: { orderBy: { createdAt: "desc" } },
      verificationRequests: { orderBy: { sentAt: "desc" } },
      surveyResponse: true,
    },
  });

  if (!order || order.customerEmail !== customer.email) {
    notFound();
  }

  const serialized = {
    ...order,
    priceEstimate: order.priceEstimate ? Number(order.priceEstimate) : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    archivedAt: order.archivedAt?.toISOString() ?? null,
    deadline: order.deadline?.toISOString() ?? null,
    files: order.files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
    auditLogs: order.auditLogs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
    verificationRequests: order.verificationRequests.map((vr) => ({
      token: vr.token,
      status: vr.status,
      sentAt: vr.sentAt.toISOString(),
      resolvedAt: vr.resolvedAt?.toISOString() ?? null,
      type: vr.type,
    })),
    surveyResponse: order.surveyResponse
      ? {
          token: order.surveyResponse.token,
          sentAt: order.surveyResponse.sentAt.toISOString(),
          submittedAt: order.surveyResponse.submittedAt?.toISOString() ?? null,
        }
      : null,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/portal">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Meine Aufträge
          </Button>
        </Link>
      </div>
      <PortalOrderDetail order={serialized} />
    </div>
  );
}

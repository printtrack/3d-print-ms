import { notFound } from "next/navigation";
import { TrackingView } from "@/components/customer/TrackingView";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ token: string }>;
}

async function getOrder(token: string) {
  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/orders/${token}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function TrackPage({ params }: PageProps) {
  const { token } = await params;
  const order = await getOrder(token);

  if (!order) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Printer className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">3D Print Service</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Neuen Auftrag einreichen
          </Link>

          <h2 className="text-2xl font-bold tracking-tight mb-6">
            Auftragsstatus
          </h2>

          <TrackingView order={order} trackingToken={token} />
        </div>
      </main>
    </div>
  );
}

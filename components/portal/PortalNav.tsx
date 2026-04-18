"use client";

import { useRouter } from "next/navigation";
import { Printer, LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Props {
  companyName: string;
  customerName?: string;
}

export function PortalNav({ companyName, customerName }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/portal/auth/signout", { method: "POST" });
    router.push("/portal/signin");
    router.refresh();
  }

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4 max-w-4xl py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Printer className="h-5 w-5 text-primary" />
            <span className="font-semibold">{companyName}</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link href="/portal" className="text-sm font-medium hover:text-primary transition-colors">
            Mein Konto
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {customerName ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                Hallo, {customerName}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                Abmelden
              </Button>
            </>
          ) : (
            <Link href="/portal/signin">
              <Button size="sm">Anmelden</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

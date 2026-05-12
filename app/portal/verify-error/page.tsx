import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerifyErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h1 className="text-xl font-bold">Bestätigungslink ungültig oder abgelaufen</h1>
      <p className="text-muted-foreground text-sm max-w-sm">
        Der Link ist nicht mehr gültig. Bitte melde dich an und fordere eine neue Bestätigungsmail an.
      </p>
      <Button asChild>
        <Link href="/portal">Zurück zum Portal</Link>
      </Button>
    </div>
  );
}

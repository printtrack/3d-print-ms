import { Printer } from "lucide-react";
import { PortalRegisterForm } from "./PortalRegisterForm";

export default function PortalRegisterPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-3">
          <Printer className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Konto erstellen</h1>
        </div>
        <PortalRegisterForm />
      </div>
    </div>
  );
}

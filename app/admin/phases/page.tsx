import { redirect } from "next/navigation";

export default function PhasesPage() {
  redirect("/admin/settings?tab=phasen");
}

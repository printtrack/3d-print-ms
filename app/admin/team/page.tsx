import { redirect } from "next/navigation";

export default function TeamPage() {
  redirect("/admin/settings?tab=team");
}

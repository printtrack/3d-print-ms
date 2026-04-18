import { redirect } from "next/navigation";

export default function MachinesPage() {
  redirect("/admin/settings?tab=maschinen");
}

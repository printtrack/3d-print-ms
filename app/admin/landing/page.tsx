import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getActor, can } from "@/lib/authz";
import { countLandingBlocks } from "@/lib/landing/page";
import { getPublishState } from "@/lib/landing/publish";
import { LandingManager } from "@/components/admin/landing/LandingManager";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  // Read-only for members without the permission — computed on the server and
  // passed down, the way OrderDetail does it, rather than checked in the client.
  const actor = await getActor();
  const canEdit = can(actor, "landing.edit");

  // An empty table means the page is still rendering the built-in defaults; the
  // publish state tells the header whether the draft has unpublished changes.
  const pristine = (await countLandingBlocks()) === 0;
  const publishState = await getPublishState();

  return <LandingManager pristine={pristine} publishState={publishState} readOnly={!canEdit} />;
}

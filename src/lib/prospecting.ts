import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";

// Every page and server action behind Leads, tasks, and phone calls calls
// this first. Hiding the nav item alone isn't enough: a direct link would
// still open the page for a workspace that doesn't have the feature yet.
export async function requireProspecting() {
  const workspace = await requireWorkspace();
  if (!workspace.prospectingEnabled) redirect("/dashboard");
  return workspace;
}

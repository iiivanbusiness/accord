import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { homePath } from "@/lib/home";

// The app's front door (the desktop app and the home-screen icon open
// here, and sign-in comes back here): send each person to their own
// starting page.
export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(await homePath());
}

import { redirect } from "next/navigation";

// Today lives on the Dashboard now; old links (emails, notifications) land
// there.
export default function TodayPage() {
  redirect("/dashboard");
}

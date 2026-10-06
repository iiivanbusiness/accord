// Where someone lands after signing in: the Dashboard, which with
// prospecting on is the day (a rep's tasks, or the team's for managers).
export async function homePath(): Promise<string> {
  return "/dashboard";
}

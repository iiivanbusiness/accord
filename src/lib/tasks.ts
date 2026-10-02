export const TASK_TYPES = ["cold_call", "sales_call", "follow_up", "other"] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const TASK_TYPE_LABEL: Record<string, string> = {
  cold_call: "Cold call",
  sales_call: "Sales call",
  follow_up: "Follow-up",
  other: "Other",
};

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABEL: Record<string, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
// Same colors as review-step priorities: normal stays quiet.
export const TASK_PRIORITY_CHIP: Record<string, string | null> = { low: "chip-neutral", normal: null, high: "chip-warn", urgent: "chip-danger" };

export const TASK_STATUS_LABEL: Record<string, string> = { open: "Open", done: "Done", skipped: "Skipped" };

// The due day is stored as a date (UTC midnight), so it's formatted in
// UTC: "Thu, Oct 8" is the day the manager picked, for every viewer.
export function formatTaskDue(dueDate: Date | string, dueTime: string | null): string {
  const day = new Date(dueDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return dueTime ? `${day} · ${dueTime}` : day;
}

export function isValidDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

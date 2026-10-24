

export const label = (s?: string | null) =>
  s?.trim()
    ? s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Not available";
export const tone = (s?: string | null) =>
  s === "high" || s === "escalated"
    ? "red-tone"
    : s === "medium" || s === "in_review"
      ? "amber-tone"
      : s?.startsWith("cleared") || ["accepted", "approved", "review_complete"].includes(s || "")
        ? "green-tone"
        : "slate-tone";
// Needed-by dates are stored as YYYY-MM-DD. Parse them as local calendar
// dates; `new Date("2026-09-08")` is UTC midnight and shows as Sep 7 in
// US time zones.
export const parseDueDate = (value?: string | null) => {
  const day = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = day
    ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
    : new Date(value ?? "");
  return Number.isNaN(date.getTime()) ? null : date;
};
export const daysUntilDue = (value?: string | null) => {
  const due = parseDueDate(value);
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
};
export const formatDueDate = (
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
) => parseDueDate(value)?.toLocaleDateString(undefined, options) ?? "No date";

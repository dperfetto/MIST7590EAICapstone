import { daysUntilDue } from "@/workspace/format";

export function DueChip({ neededBy }: { neededBy: string }) {
  const days = daysUntilDue(neededBy);
  if (days === null || days > 3) return null;
  const text =
    days < 0
      ? `Overdue ${-days} ${-days === 1 ? "day" : "days"}`
      : days === 0
        ? "Due today"
        : `Due in ${days} ${days === 1 ? "day" : "days"}`;
  return (
    <em className={`due-chip ${days < 0 ? "red-tone" : "amber-tone"}`}>
      {text}
    </em>
  );
}

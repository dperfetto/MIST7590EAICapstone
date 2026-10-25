// Workflow reporting: how long reviews take, and how the open workload sits
// against its needed-by dates. Kept free of UI and app imports so tests can
// load it directly.

type MetricAgreement = { id: string; agreementType: string; status: string; neededBy: string; createdAt: string };
type MetricFinding = { agreementId: string; status: string; decidedAt?: string | null };

const DONE_FINDING = ["accepted", "dismissed"];
const HOUR = 3_600_000;

/** An agreement whose review is finished: cleared or approved, or every finding accepted or dismissed. */
export function isReviewComplete(agreement: MetricAgreement, findings: MetricFinding[]) {
  if (agreement.status?.startsWith("cleared") || ["approved", "review_complete"].includes(agreement.status)) return true;
  const own = findings.filter((f) => f.agreementId === agreement.id);
  return own.length > 0 && own.every((f) => DONE_FINDING.includes(f.status));
}

const time = (value?: string | null) => {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
};
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export type ReviewTimes = {
  /** Agreements with at least one recorded decision. */
  decided: number;
  /** Finished reviews whose completion time is known. */
  completed: number;
  medianHoursToFirstDecision: number | null;
  medianHoursToComplete: number | null;
  /** Hours the longest-waiting unfinished agreement has been open. */
  oldestOpenHours: number | null;
  byType: { agreementType: string; completed: number; medianHoursToComplete: number | null }[];
};

/**
 * Submission is the agreement's created time; a review's first decision and
 * completion are the earliest and latest decided times of its findings.
 * Findings decided before decision times were recorded are left out rather
 * than guessed.
 */
export function reviewTimes(agreements: MetricAgreement[], findings: MetricFinding[], now = Date.now()): ReviewTimes {
  const toFirst: number[] = [];
  const toComplete: { agreementType: string; hours: number }[] = [];
  const openAges: number[] = [];
  for (const agreement of agreements) {
    const submitted = time(agreement.createdAt);
    if (submitted === null) continue;
    const decided = findings
      .filter((f) => f.agreementId === agreement.id)
      .map((f) => time(f.decidedAt))
      .filter((t): t is number => t !== null);
    const complete = isReviewComplete(agreement, findings);
    if (decided.length) toFirst.push(Math.max(0, Math.min(...decided) - submitted) / HOUR);
    if (complete && decided.length)
      toComplete.push({ agreementType: agreement.agreementType, hours: Math.max(0, Math.max(...decided) - submitted) / HOUR });
    if (!complete) openAges.push(Math.max(0, now - submitted) / HOUR);
  }
  const types = [...new Set(toComplete.map((row) => row.agreementType))].sort();
  return {
    decided: toFirst.length,
    completed: toComplete.length,
    medianHoursToFirstDecision: median(toFirst),
    medianHoursToComplete: median(toComplete.map((row) => row.hours)),
    oldestOpenHours: openAges.length ? Math.max(...openAges) : null,
    byType: types.map((agreementType) => {
      const rows = toComplete.filter((row) => row.agreementType === agreementType);
      return { agreementType, completed: rows.length, medianHoursToComplete: median(rows.map((row) => row.hours)) };
    }),
  };
}

/** "Under 1 hour", "5 hours", "2.5 days". */
export function formatHours(hours: number | null) {
  if (hours === null) return "No data yet";
  if (hours < 1) return "Under 1 hour";
  if (hours < 48) {
    const h = Math.round(hours);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days} days`;
}

export type ReviewHealth = { withinTarget: number; dueSoon: number; overdue: number; undated: number; percentWithinTarget: number | null };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
// Needed-by dates are local calendar days (YYYY-MM-DD).
const dueDay = (value: string) => {
  const day = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).getTime() : null;
};

/**
 * Unfinished agreements against their needed-by date: overdue once the date
 * has passed, due soon within two days, otherwise within target.
 */
export function reviewHealth(agreements: MetricAgreement[], findings: MetricFinding[], today = new Date()): ReviewHealth {
  const base = startOfDay(today);
  const health = { withinTarget: 0, dueSoon: 0, overdue: 0, undated: 0 };
  for (const agreement of agreements) {
    if (isReviewComplete(agreement, findings)) continue;
    const due = dueDay(agreement.neededBy);
    if (due === null) health.undated += 1;
    else {
      const days = Math.round((due - base) / 86_400_000);
      if (days < 0) health.overdue += 1;
      else if (days <= 2) health.dueSoon += 1;
      else health.withinTarget += 1;
    }
  }
  const dated = health.withinTarget + health.dueSoon + health.overdue;
  return { ...health, percentWithinTarget: dated ? Math.round((health.withinTarget / dated) * 100) : null };
}

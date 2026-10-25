import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { formatHours, isReviewComplete, reviewHealth, reviewTimes } from "../src/lib/reviewMetrics.ts";

const hoursAfter = (start, hours) => new Date(new Date(start).getTime() + hours * 3_600_000).toISOString();
const start = "2026-10-01T09:00:00Z";
const agreement = (id, extra = {}) => ({ id, agreementType: "Software Subscription", status: "in_review", neededBy: "", createdAt: start, ...extra });

test("a review is complete when cleared or when every finding is accepted or dismissed", () => {
  assert.equal(isReviewComplete(agreement("a", { status: "cleared_with_conditions" }), []), true);
  const findings = [
    { agreementId: "a", status: "accepted" },
    { agreementId: "a", status: "dismissed" },
    { agreementId: "b", status: "escalated" },
  ];
  assert.equal(isReviewComplete(agreement("a"), findings), true);
  assert.equal(isReviewComplete(agreement("b"), findings), false);
  assert.equal(isReviewComplete(agreement("c"), findings), false);
});

test("review times measure submission to first and last decision, as medians", () => {
  const agreements = [
    agreement("fast"),
    agreement("slow", { agreementType: "Professional Services" }),
    agreement("open"),
    agreement("legacy"),
  ];
  const findings = [
    { agreementId: "fast", status: "accepted", decidedAt: hoursAfter(start, 2) },
    { agreementId: "fast", status: "dismissed", decidedAt: hoursAfter(start, 6) },
    { agreementId: "slow", status: "accepted", decidedAt: hoursAfter(start, 10) },
    { agreementId: "slow", status: "accepted", decidedAt: hoursAfter(start, 50) },
    { agreementId: "open", status: "accepted", decidedAt: hoursAfter(start, 4) },
    { agreementId: "open", status: "open" },
    // Decided before decision times were recorded: left out, not guessed.
    { agreementId: "legacy", status: "accepted" },
  ];
  const times = reviewTimes(agreements, findings, new Date(hoursAfter(start, 72)).getTime());
  assert.equal(times.decided, 3);
  assert.equal(times.completed, 2);
  assert.equal(times.medianHoursToFirstDecision, 4);
  assert.equal(times.medianHoursToComplete, 28);
  assert.equal(times.oldestOpenHours, 72);
  assert.deepEqual(times.byType, [
    { agreementType: "Professional Services", completed: 1, medianHoursToComplete: 50 },
    { agreementType: "Software Subscription", completed: 1, medianHoursToComplete: 6 },
  ]);
});

test("no decisions yet means no review time rather than zero", () => {
  const times = reviewTimes([agreement("a")], [], new Date(start).getTime());
  assert.equal(times.medianHoursToFirstDecision, null);
  assert.equal(times.medianHoursToComplete, null);
  assert.equal(formatHours(times.medianHoursToComplete), "No data yet");
});

test("durations read in hours under two days and in days after", () => {
  assert.equal(formatHours(0.4), "Under 1 hour");
  assert.equal(formatHours(1), "1 hour");
  assert.equal(formatHours(28), "28 hours");
  assert.equal(formatHours(60), "2.5 days");
});

test("review health sorts unfinished agreements by needed-by date", () => {
  const today = new Date(2026, 9, 25);
  const agreements = [
    agreement("late", { neededBy: "2026-10-24" }),
    agreement("today", { neededBy: "2026-10-25" }),
    agreement("soon", { neededBy: "2026-10-27" }),
    agreement("fine", { neededBy: "2026-11-30" }),
    agreement("fine2", { neededBy: "2026-11-02" }),
    agreement("nodate", { neededBy: "" }),
    agreement("done", { neededBy: "2026-10-01", status: "approved" }),
  ];
  assert.deepEqual(reviewHealth(agreements, [], today), {
    withinTarget: 2,
    dueSoon: 2,
    overdue: 1,
    undated: 1,
    percentWithinTarget: 40,
  });
  assert.equal(reviewHealth([], [], today).percentWithinTarget, null);
});

test("review health is computed, not hard-coded", () => {
  const reports = readFileSync(new URL("../src/pages/Reports.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(reports, /<b>7<\/b>|<b>2<\/b>|78%/, "review health must not be hard-coded");
});

test("schema only lets an Approver or Administrator change an escalated finding", () => {
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  const policy = schema.match(/create policy "Review team updates findings"[\s\S]*?;/)?.[0] ?? "";
  assert.match(policy, /status <> 'escalated' or public\.current_user_role\(\) in \('approver','administrator'\)/);
  assert.match(policy, /with check/);
});

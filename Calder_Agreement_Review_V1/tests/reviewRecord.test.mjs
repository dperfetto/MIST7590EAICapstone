import assert from "node:assert/strict";
import test from "node:test";
import { decisionTrail } from "../src/lib/reviewRecord.ts";

const event = (eventType, detail, actorName, createdAt) => ({ eventType, detail, actorName, createdAt });

test("the trail lists each decision with who made it, oldest first", () => {
  const cap = { id: "f1", provision: "Cap on Liability", status: "accepted", decisionReason: "Approved by Legal", decidedAt: "2026-10-28T10:00:00Z" };
  const events = [
    event("Finding accepted", "Cap on Liability: Approved by Legal", "Morgan Approver", "2026-10-28T10:00:00Z"),
    event("Comment added", "Cap on Liability: question", "Sam", "2026-10-27T12:00:00Z"),
    event("Finding escalated", "Cap on Liability: Below standard", "Priya Reviewer", "2026-10-27T09:00:00Z"),
    event("Finding accepted", "Insurance: fine", "Priya Reviewer", "2026-10-27T08:00:00Z"),
  ];
  assert.deepEqual(decisionTrail(cap, [cap], events), [
    { status: "escalated", reason: "Below standard", actor: "Priya Reviewer", date: "2026-10-27T09:00:00Z" },
    { status: "accepted", reason: "Approved by Legal", actor: "Morgan Approver", date: "2026-10-28T10:00:00Z" },
  ]);
});

test("without visible events the finding's own decision is shown, unnamed", () => {
  const finding = { id: "f1", provision: "Insurance", status: "dismissed", decisionReason: "Not an obligation", decidedAt: "2026-10-20T00:00:00Z" };
  assert.deepEqual(decisionTrail(finding, [finding], []), [
    { status: "dismissed", reason: "Not an obligation", date: "2026-10-20T00:00:00Z" },
  ]);
});

test("two findings for the same provision are not mixed up", () => {
  const a = { id: "a", provision: "Insurance", status: "accepted", decisionReason: "Yes", decidedAt: "2026-10-20T00:00:00Z" };
  const b = { id: "b", provision: "Insurance", status: "dismissed", decisionReason: "No", decidedAt: "2026-10-21T00:00:00Z" };
  const events = [event("Finding accepted", "Insurance: Yes", "Priya", "2026-10-20T00:00:00Z"), event("Finding dismissed", "Insurance: No", "Priya", "2026-10-21T00:00:00Z")];
  assert.deepEqual(decisionTrail(b, [a, b], events), [{ status: "dismissed", reason: "No", date: "2026-10-21T00:00:00Z" }]);
});

test("an undecided finding has an empty trail", () => {
  const open = { id: "o", provision: "Audit Rights", status: "open" };
  assert.deepEqual(decisionTrail(open, [open], []), []);
});

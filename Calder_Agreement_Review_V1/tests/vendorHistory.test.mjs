import assert from "node:assert/strict";
import test from "node:test";
import { provisionSummary, vendorHistory, vendorKey } from "../src/lib/vendorHistory.ts";

test("vendor names match across punctuation, case and legal suffixes", () => {
  assert.equal(vendorKey("Northstar Cloud Systems, Inc."), "northstar cloud systems");
  assert.equal(vendorKey("NORTHSTAR  cloud systems llc"), "northstar cloud systems");
  assert.equal(vendorKey("Smith & Co."), vendorKey("smith and company"));
  assert.equal(vendorKey("Company"), "company");
  assert.notEqual(vendorKey("Northstar Cloud"), vendorKey("Northstar Cloud Systems"));
});

const agreement = (id, vendor, createdAt) => ({ id, vendor, agreementType: "Software Subscription", status: "cleared", createdAt });
const agreements = [
  agreement("current", "Northstar Cloud Systems", "2026-10-20T00:00:00Z"),
  agreement("old", "Northstar Cloud Systems Inc", "2025-11-01T00:00:00Z"),
  agreement("newer", "northstar cloud systems, LLC", "2026-06-01T00:00:00Z"),
  agreement("other", "Apex Field Services", "2026-05-01T00:00:00Z"),
];
const findings = [
  { agreementId: "current", provision: "Cap on Liability", status: "open" },
  { agreementId: "old", provision: "Cap on Liability", status: "escalated", decisionReason: "Below standard" },
  { agreementId: "newer", provision: "Cap on Liability", status: "accepted", decisionReason: "Approved by Legal" },
  { agreementId: "newer", provision: "Insurance", status: "open" },
  { agreementId: "other", provision: "Cap on Liability", status: "dismissed" },
];

test("history lists the vendor's other agreements newest first and tallies decisions", () => {
  const history = vendorHistory(agreements[0], agreements, findings);
  assert.deepEqual(history.agreements.map((a) => a.id), ["newer", "old"]);
  const cap = history.provisions.find((p) => p.provision === "Cap on Liability");
  assert.deepEqual(
    { accepted: cap.accepted, dismissed: cap.dismissed, escalated: cap.escalated, open: cap.open },
    { accepted: 1, dismissed: 0, escalated: 1, open: 0 },
  );
  assert.equal(cap.latest.agreementId, "newer");
  assert.equal(cap.latest.reason, "Approved by Legal");
  assert.equal(history.provisions[0].provision, "Cap on Liability", "decided provisions come first");
});

test("a vendor seen for the first time has no history", () => {
  const history = vendorHistory(agreements[3], agreements, findings);
  assert.deepEqual(history, { agreements: [], provisions: [] });
});

test("finding notes summarize past decisions in plain words", () => {
  assert.equal(provisionSummary(undefined), null);
  assert.equal(provisionSummary({ provision: "X", accepted: 1, dismissed: 0, escalated: 1, open: 0 }), "Accepted 1 of 2 times before; escalated once");
  assert.equal(provisionSummary({ provision: "X", accepted: 1, dismissed: 0, escalated: 0, open: 0 }), "Accepted 1 of 1 time before");
  assert.equal(provisionSummary({ provision: "X", accepted: 0, dismissed: 1, escalated: 0, open: 0 }), "Dismissed 1 of 1 time before");
  assert.equal(provisionSummary({ provision: "X", accepted: 0, dismissed: 0, escalated: 0, open: 2 }), "Seen 2 times before, not yet decided");
});

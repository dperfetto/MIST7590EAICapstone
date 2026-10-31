import assert from "node:assert/strict";
import test from "node:test";
import { latestVersion, nextVersion, playbookChange, provisionCoverage, versionLabel, versionNumber } from "../src/lib/playbookVersions.ts";
import { commentPreview, MAX_COMMENT_LENGTH, validateComment } from "../src/lib/comments.ts";

const v = (version, activeProvisions, agreementType = "Software Subscription") => ({
  agreementType, version, activeProvisions, summary: "", changedBy: "", createdAt: "",
});
const versions = [
  v(1, ["Cap on Liability", "Governing Law"]),
  v(2, ["Cap on Liability", "Exclusivity", "Governing Law"]),
  v(3, ["Cap on Liability", "Exclusivity"]),
  v(1, ["Insurance"], "Professional Services"),
];

test("version labels round-trip, and labels from before versioning count as v1", () => {
  assert.equal(versionNumber("Software Subscription v12"), 12);
  assert.equal(versionNumber(versionLabel("Mutual NDA", 4)), 4);
  assert.equal(versionNumber("Global v1"), 1);
  assert.equal(versionNumber(""), 1);
  assert.equal(versionNumber(undefined), 1);
});

test("the next version numbers on from the latest for that contract type only", () => {
  assert.equal(latestVersion(versions, "Software Subscription").version, 3);
  const next = nextVersion(versions, "Software Subscription", ["Governing Law", "Audit Rights"], "Audit Rights switched on", "Ada", "t");
  assert.equal(next.version, 4);
  assert.deepEqual(next.activeProvisions, ["Audit Rights", "Governing Law"]);
  assert.equal(nextVersion(versions, "Licensing", [], "x", "Ada", "t").version, 1);
});

test("an older review lists the provisions added and removed since", () => {
  assert.deepEqual(playbookChange(versions, { agreementType: "Software Subscription", playbookVersion: "Software Subscription v1" }), {
    from: 1, to: 3, added: ["Exclusivity"], removed: ["Governing Law"],
  });
  assert.deepEqual(playbookChange(versions, { agreementType: "Software Subscription", playbookVersion: "Software Subscription v2" }), {
    from: 2, to: 3, added: [], removed: ["Governing Law"],
  });
});

test("current reviews, unknown versions and unversioned types are not flagged", () => {
  assert.equal(playbookChange(versions, { agreementType: "Software Subscription", playbookVersion: "Software Subscription v3" }), null);
  assert.equal(playbookChange(versions, { agreementType: "Professional Services", playbookVersion: "Professional Services v1" }), null);
  assert.equal(playbookChange(versions, { agreementType: "Licensing", playbookVersion: "Licensing v1" }), null);
  // Switched off and on again since the review: nothing changed for it.
  assert.equal(playbookChange([...versions, v(4, ["Cap on Liability", "Exclusivity", "Governing Law"])], { agreementType: "Software Subscription", playbookVersion: "Software Subscription v2" }), null);
  assert.equal(playbookChange([v(3, ["A"])], { agreementType: "Software Subscription", playbookVersion: "Software Subscription v1" }), null);
});

test("comments are trimmed, must not be blank and have a length limit", () => {
  assert.deepEqual(validateComment("  Can we push back?  "), { ok: true, body: "Can we push back?" });
  assert.equal(validateComment("   ").ok, false);
  assert.equal(validateComment(undefined).ok, false);
  assert.equal(validateComment("x".repeat(MAX_COMMENT_LENGTH)).ok, true);
  assert.equal(validateComment("x".repeat(MAX_COMMENT_LENGTH + 1)).ok, false);
  assert.equal(commentPreview("short"), "short");
  assert.equal(commentPreview("x".repeat(200)).length, 120);
});

test("coverage counts agreements checked under the version they were analyzed with", () => {
  const versions = [
    { agreementType: "Mutual NDA", version: 1, activeProvisions: ["Governing Law"] },
    { agreementType: "Mutual NDA", version: 2, activeProvisions: ["Cap on Liability", "Governing Law"] },
  ];
  const agreements = [
    { id: "a", agreementType: "Mutual NDA", playbookVersion: "Mutual NDA v1" },
    { id: "b", agreementType: "Mutual NDA", playbookVersion: "Mutual NDA v2" },
    { id: "c", agreementType: "Other", playbookVersion: "Other v1" }, // no version history
  ];
  const findings = [
    { agreementId: "a", provision: "Governing Law", status: "accepted" },
    { agreementId: "a", provision: "Governing Law", status: "dismissed" },
    { agreementId: "b", provision: "Cap on Liability", status: "open" },
    { agreementId: "c", provision: "Insurance", status: "escalated" }, // a manual finding counts as checked
    { agreementId: "gone", provision: "Insurance", status: "accepted" }, // unknown agreement is ignored
  ];
  const [cap, law, insurance, audit] = provisionCoverage(
    ["Cap on Liability", "Governing Law", "Insurance", "Audit Rights"], agreements, findings, versions,
  );
  assert.deepEqual(cap, { provision: "Cap on Liability", checked: 1, flagged: 1, confirmed: 0, dismissed: 0, awaiting: 1 });
  assert.deepEqual(law, { provision: "Governing Law", checked: 2, flagged: 1, confirmed: 1, dismissed: 1, awaiting: 0 });
  assert.deepEqual(insurance, { provision: "Insurance", checked: 1, flagged: 1, confirmed: 0, dismissed: 0, awaiting: 1 });
  assert.equal(audit.checked, 0);
});

// Vendor history: what has Calder seen and decided before for this vendor?
// Kept free of UI and app imports so tests can load it directly.

type HistoryAgreement = { id: string; vendor: string; agreementType: string; status: string; createdAt: string };
type HistoryFinding = { agreementId: string; provision: string; status: string; decisionReason?: string };

// Legal-form words that vary between submissions of the same vendor.
const LEGAL_SUFFIXES = new Set([
  "inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation",
  "co", "company", "plc", "lp", "llp", "gmbh",
]);

/** "Northstar Cloud Systems, Inc." and "northstar cloud systems" are the same vendor. */
export function vendorKey(name: string) {
  const words = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

export type ProvisionHistory = {
  provision: string;
  accepted: number;
  dismissed: number;
  escalated: number;
  open: number;
  /** Most recent decided finding for this provision, with its reason. */
  latest?: { agreementId: string; status: string; reason?: string; date: string };
};

export type VendorHistory<A extends HistoryAgreement> = {
  agreements: A[];
  provisions: ProvisionHistory[];
};

/** Other agreements with the same vendor, newest first, and how each provision was decided across them. */
export function vendorHistory<A extends HistoryAgreement, F extends HistoryFinding>(
  current: A,
  agreements: A[],
  findings: F[],
): VendorHistory<A> {
  const key = vendorKey(current.vendor);
  const others = agreements
    .filter((a) => a.id !== current.id && vendorKey(a.vendor) === key)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const dateOf = new Map(others.map((a) => [a.id, a.createdAt]));
  const byProvision = new Map<string, ProvisionHistory>();
  for (const f of findings) {
    if (!dateOf.has(f.agreementId)) continue;
    const row = byProvision.get(f.provision) ?? { provision: f.provision, accepted: 0, dismissed: 0, escalated: 0, open: 0 };
    if (f.status === "accepted") row.accepted += 1;
    else if (f.status === "dismissed") row.dismissed += 1;
    else if (f.status === "escalated") row.escalated += 1;
    else row.open += 1;
    if (f.status !== "open") {
      const date = dateOf.get(f.agreementId)!;
      if (!row.latest || date > row.latest.date)
        row.latest = { agreementId: f.agreementId, status: f.status, reason: f.decisionReason, date };
    }
    byProvision.set(f.provision, row);
  }
  const provisions = [...byProvision.values()].sort(
    (a, b) =>
      b.accepted + b.dismissed + b.escalated - (a.accepted + a.dismissed + a.escalated) ||
      a.provision.localeCompare(b.provision),
  );
  return { agreements: others, provisions };
}

/** One line for a finding card, e.g. "Accepted 2 of 3 times before; escalated once". */
export function provisionSummary(row?: ProvisionHistory) {
  if (!row) return null;
  const decided = row.accepted + row.dismissed + row.escalated;
  if (!decided) return `Seen ${row.open === 1 ? "once" : `${row.open} times`} before, not yet decided`;
  const times = (n: number) => (n === 1 ? "once" : `${n} times`);
  const counts: [string, number][] = [
    ["accepted", row.accepted],
    ["dismissed", row.dismissed],
    ["escalated", row.escalated],
  ];
  const [leadName, leadCount] = counts.find(([, n]) => n > 0)!;
  const parts = [
    `${leadName[0].toUpperCase()}${leadName.slice(1)} ${leadCount} of ${decided} time${decided === 1 ? "" : "s"} before`,
    ...counts.filter(([name, n]) => n > 0 && name !== leadName).map(([name, n]) => `${name} ${times(n)}`),
  ];
  return parts.join("; ");
}

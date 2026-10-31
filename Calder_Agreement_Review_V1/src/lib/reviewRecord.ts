// The printable review record for a completed agreement: each finding with
// the decisions recorded on it, taken from the agreement's audit events.
// Kept free of UI and app imports so tests can load it directly.

type RecordFinding = { id: string; provision: string; status: string; decisionReason?: string; decidedAt?: string | null };
type RecordEvent = { actorName: string; eventType: string; detail: string; createdAt: string };

export type DecisionStep = { status: string; reason?: string; actor?: string; date?: string | null };

/**
 * Every decision recorded on a finding, oldest first, e.g. escalated by a
 * Reviewer and then accepted by an Approver. Decisions are written to the audit
 * log as "Finding <status>" with detail "<provision>: <reason>". When that
 * history is not available (the reader cannot see those events, or two
 * findings share a provision so the events cannot be told apart), the
 * finding's own final decision is returned without a name.
 */
export function decisionTrail(finding: RecordFinding, findings: RecordFinding[], events: RecordEvent[]): DecisionStep[] {
  const shared = findings.filter((f) => f.provision === finding.provision).length > 1;
  const steps: DecisionStep[] = shared
    ? []
    : events
        .filter((e) => e.eventType.startsWith("Finding ") && e.detail.startsWith(`${finding.provision}: `))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((e) => ({
          status: e.eventType.slice("Finding ".length),
          reason: e.detail.slice(finding.provision.length + 2),
          actor: e.actorName,
          date: e.createdAt,
        }));
  const last = steps[steps.length - 1];
  if (finding.status !== "open" && (!last || last.status !== finding.status))
    steps.push({ status: finding.status, reason: finding.decisionReason, date: finding.decidedAt });
  return steps;
}

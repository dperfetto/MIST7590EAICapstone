// Playbook versions: every change to a contract type's playbook is numbered,
// each agreement records the version it was reviewed under, and an older
// review can be re-evaluated against the current playbook.
// Kept free of UI and app imports so tests can load it directly.

export type PlaybookVersion = {
  agreementType: string;
  version: number;
  /** Provisions switched on in this version, sorted. */
  activeProvisions: string[];
  summary: string;
  changedBy: string;
  createdAt: string;
};

/** "Software Subscription v3" → 3. Labels from before versioning count as v1. */
export function versionNumber(label: string | null | undefined) {
  const match = /\bv(\d+)\s*$/i.exec(label ?? "");
  return match ? Number(match[1]) : 1;
}

export const versionLabel = (agreementType: string, version: number) => `${agreementType} v${version}`;

export function versionsFor(versions: PlaybookVersion[], agreementType: string) {
  return versions
    .filter((v) => v.agreementType === agreementType)
    .sort((a, b) => b.version - a.version);
}

export function latestVersion(versions: PlaybookVersion[], agreementType: string) {
  return versionsFor(versions, agreementType)[0];
}

/** The next version after a provision is switched on or off. */
export function nextVersion(
  versions: PlaybookVersion[],
  agreementType: string,
  activeProvisions: string[],
  summary: string,
  changedBy: string,
  createdAt: string,
): PlaybookVersion {
  return {
    agreementType,
    version: (latestVersion(versions, agreementType)?.version ?? 0) + 1,
    activeProvisions: [...activeProvisions].sort(),
    summary,
    changedBy,
    createdAt,
  };
}

export type PlaybookChange = {
  from: number;
  to: number;
  /** Switched on since the review: these were never checked. */
  added: string[];
  /** Switched off since the review: earlier findings and decisions are kept. */
  removed: string[];
};

/**
 * What changed in the agreement's playbook since it was reviewed, or null if
 * it was reviewed under the current version (or versions are not recorded).
 */
export function playbookChange(
  versions: PlaybookVersion[],
  agreement: { agreementType: string; playbookVersion: string },
): PlaybookChange | null {
  const latest = latestVersion(versions, agreement.agreementType);
  const from = versionNumber(agreement.playbookVersion);
  if (!latest || latest.version <= from) return null;
  const reviewed = versionsFor(versions, agreement.agreementType).find((v) => v.version === from);
  // Without the older snapshot there is nothing reliable to compare against.
  if (!reviewed) return null;
  const before = new Set(reviewed.activeProvisions);
  const after = new Set(latest.activeProvisions);
  const added = latest.activeProvisions.filter((p) => !before.has(p));
  const removed = reviewed.activeProvisions.filter((p) => !after.has(p));
  // Switched off and back on again: nothing to re-evaluate.
  if (!added.length && !removed.length) return null;
  return { from, to: latest.version, added, removed };
}

// Reporting: for each provision, how many agreements were checked for it,
// flagged with it and confirmed by a reviewer.
type CoverageAgreement = { id: string; agreementType: string; playbookVersion: string };
type CoverageFinding = { agreementId: string; provision: string; status: string };
type CoverageVersion = { agreementType: string; version: number; activeProvisions: string[] };

export type ProvisionCoverage = {
  provision: string;
  /** Agreements whose playbook version included the provision, or that have a finding for it. */
  checked: number;
  /** Agreements with at least one finding for the provision. */
  flagged: number;
  /** Agreements where a reviewer accepted a finding for it. */
  confirmed: number;
  /** Findings a reviewer dismissed as wrong. */
  dismissed: number;
  /** Findings still open or escalated. */
  awaiting: number;
};

/** The provisions an agreement was checked for, from the playbook version it was analyzed under. */
function checkedProvisions(agreement: CoverageAgreement, versions: CoverageVersion[]) {
  const wanted = versionNumber(agreement.playbookVersion);
  const match = versions.find((v) => v.agreementType === agreement.agreementType && v.version === wanted);
  // A version missing from the history is not guessed at: the agreement then
  // counts as checked only for provisions it has findings for.
  return new Set(match?.activeProvisions ?? []);
}

export function provisionCoverage(
  provisions: string[],
  agreements: CoverageAgreement[],
  findings: CoverageFinding[],
  versions: CoverageVersion[],
): ProvisionCoverage[] {
  const known = new Set(agreements.map((a) => a.id));
  const checkedBy = new Map(agreements.map((a) => [a.id, checkedProvisions(a, versions)]));
  return provisions.map((provision) => {
    const own = findings.filter((f) => f.provision === provision && known.has(f.agreementId));
    const flagged = new Set(own.map((f) => f.agreementId));
    return {
      provision,
      checked: agreements.filter((a) => checkedBy.get(a.id)!.has(provision) || flagged.has(a.id)).length,
      flagged: flagged.size,
      confirmed: new Set(own.filter((f) => f.status === "accepted").map((f) => f.agreementId)).size,
      dismissed: own.filter((f) => f.status === "dismissed").length,
      awaiting: own.filter((f) => f.status === "open" || f.status === "escalated").length,
    };
  });
}

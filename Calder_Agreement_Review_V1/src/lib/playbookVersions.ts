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

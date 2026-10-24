import { type Agreement, type Finding, type Rule } from "@/workspace/types";
import { useState } from "react";
import { type PlaybookChange as Change, versionLabel } from "@/lib/playbookVersions";
import { analyzeExtractedText, loadAgreementText } from "@/lib/analyze";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

const list = (items: string[]) =>
  items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * Shown when the agreement was reviewed under an older playbook. Re-evaluating
 * checks only the provisions switched on since then; earlier findings and
 * decisions are left exactly as they are.
 */
export function PlaybookChange({
  agreement,
  change,
  findings,
  rules,
  canReevaluate,
  submit,
}: {
  agreement: Agreement;
  change: Change;
  findings: Finding[];
  rules: Rule[];
  canReevaluate: boolean;
  submit: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [status, setStatus] = useState(""),
    [running, setRunning] = useState(false);
  const alreadyFound = new Set(findings.map((f) => f.provision));
  const toCheck = change.added.filter((p) => !alreadyFound.has(p));

  const reevaluate = async () => {
    setRunning(true);
    try {
      let rows: unknown[] = [];
      let method = "manual";
      let note = "";
      let checked: string[] = [];
      if (toCheck.length) {
        const mode = agreement.analysisPath ?? "automatic";
        const text = mode === "manual" ? null : await loadAgreementText(agreement.storageKey);
        if (mode === "manual") note = `Manual-review agreement: check ${list(toCheck)} by hand.`;
        else if (!text) note = `The agreement file is not available here, so ${list(toCheck)} must be checked by hand.`;
        else {
          setStatus(`Checking ${list(toCheck)}…`);
          const result = await analyzeExtractedText(
            text,
            agreement.agreementType,
            mode,
            rules.filter((r) => r.agreementType === agreement.agreementType && r.active && toCheck.includes(r.provision)),
          );
          rows = result.findings.filter((f) => toCheck.includes(f.provision));
          method = result.method;
          checked = toCheck;
          if (!rows.length) note = `No ${list(toCheck)} language was found.`;
        }
      }
      const saved = await submit({
        action: "reevaluate_agreement",
        agreementId: agreement.id,
        added: change.added,
        checked,
        removed: change.removed,
        analysisMethod: method,
        findings: rows,
        note,
      });
      setStatus(saved ? "" : "Re-evaluation was not saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Re-evaluation failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="playbook-change" role="status">
      <RefreshCw size={17} aria-hidden="true" />
      <div>
        <strong>
          Reviewed under {versionLabel(agreement.agreementType, change.from)}; the playbook is now v{change.to}
        </strong>
        <span>
          {change.added.length > 0 && <>Added since: {list(change.added)}. </>}
          {change.removed.length > 0 && <>Removed since: {list(change.removed)} (earlier findings and decisions stay). </>}
          {canReevaluate
            ? toCheck.length
              ? `Re-evaluating checks ${list(toCheck)} only; nothing already decided changes.`
              : "Re-evaluating records the new version; no new provisions need checking."
            : "A reviewer can re-evaluate this agreement against the current playbook."}
        </span>
        {status && <span className="playbook-change-status">{status}</span>}
      </div>
      {canReevaluate && (
        <Button size="sm" onClick={() => void reevaluate()} disabled={running} aria-busy={running}>
          {running ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Re-evaluate under v{change.to}
        </Button>
      )}
    </div>
  );
}

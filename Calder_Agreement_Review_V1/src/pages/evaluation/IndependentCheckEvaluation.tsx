import { type EvaluationRun } from "@/lib/data";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const editTypeLabels: Record<string, string> = {
  "remove-protection": "Remove a protection",
  "change-liability-cap": "Change a liability cap",
  "shorten-notice-period": "Shorten a notice period",
  "insert-unusual-clause": "Insert an unusual clause",
};
const yesNo = (value: boolean | null) => (value == null ? "n/a" : value ? "Yes" : "No");
/**
 * Section 6.3: deliberately modified standard-form agreements. Each edited
 * provision is checked on the original and the modified version, against
 * answers the team knows because it made the edits.
 */
export function IndependentCheckEvaluation({ runs }: { runs: EvaluationRun[] }) {
  const [runId, setRunId] = useState(runs[0]?.id ?? ""),
    [filter, setFilter] = useState<"all" | "misses">("all");
  const run = runs.find((r) => r.id === runId);
  const edits = useMemo(() => {
    if (!run) return [];
    const keys = [...new Set(run.checks.map((c) => `${c.document}|${c.provision}`))];
    return keys.map((key) => {
      const checks = run.checks.filter((c) => `${c.document}|${c.provision}` === key);
      return {
        key,
        original: checks.find((c) => c.version === "original"),
        modified: checks.find((c) => c.version === "modified"),
      };
    });
  }, [run]);
  const byType = useMemo(() => {
    if (!run) return [];
    return Object.keys(editTypeLabels)
      .map((type) => {
        const checks = run.checks.filter((c) => c.editType === type);
        return {
          type,
          edits: checks.length / 2,
          checks: checks.length,
          ai: checks.filter((c) => c.correct).length,
          keyword: checks.filter((c) => c.keywordCorrect).length,
        };
      })
      .filter((t) => t.checks);
  }, [run]);
  if (!run)
    return (
      <Card>
        <CardHeader>
          <CardTitle>No independent check results yet</CardTitle>
          <p>
            Run <code>evaluation/run_independent_check_ai.mjs</code>, build the report
            with <code>evaluation/build_independent_check_ai_report.py --sql</code>,
            then paste the generated SQL file into the Supabase SQL Editor. Demo mode
            has no evaluation results.
          </p>
        </CardHeader>
      </Card>
    );
  const total = run.checks.length;
  const aiCorrect = run.checks.filter((c) => c.correct).length;
  const keywordCorrect = run.checks.filter((c) => c.keywordCorrect).length;
  const shown = edits.filter(
    (e) => filter === "all" || !e.original?.correct || !e.modified?.correct,
  );
  return (
    <>
      <Card>
        <CardHeader className="table-tools">
          <div>
            <CardTitle>{run.label}</CardTitle>
            <p>
              {run.contracts} agreements · {run.aiCalls} AI calls ·{" "}
              {run.aiFallbacks
                ? `${run.aiFallbacks} fell back to keyword matching`
                : "no AI fallbacks"}{" "}
              · answer key: the team's own edits
            </p>
          </div>
          {runs.length > 1 && (
            <Select value={runId} onValueChange={setRunId}>
              <SelectTrigger className="type-filter" aria-label="Evaluation run">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {runs.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="evaluation-table independent-table">
          <div className="evaluation-head">
            <span>Edit type</span>
            <span>Edits</span>
            <span>AI checks correct</span>
            <span>Keyword-only correct</span>
          </div>
          {byType.map((t) => (
            <div key={t.type} className="independent-row">
              <b>{editTypeLabels[t.type]}</b>
              <span data-label="Edits">{t.edits}</span>
              <span data-label="AI checks correct">
                {t.ai} of {t.checks}
                <Progress value={(t.ai / t.checks) * 100} />
              </span>
              <span data-label="Keyword-only correct">
                {t.keyword} of {t.checks}
                <Progress className="keyword" value={(t.keyword / t.checks) * 100} />
              </span>
            </div>
          ))}
          <p className="evaluation-note">
            {aiCorrect} of {total} checks correct on the AI path ({keywordCorrect} of{" "}
            {total} for keyword matching). Each edit is checked twice: is the edited
            provision flagged on the original, and on the modified agreement? A drop
            is a finding, not a failure.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="table-tools">
          <div>
            <CardTitle>Edits</CardTitle>
            <p>What the AI flagged before and after each edit, with the team's diagnosis of each miss</p>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="status-filter" aria-label="Filter edits">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All edits</SelectItem>
              <SelectItem value="misses">Edits with a miss</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="evaluation-detail">
          {shown.map(({ key, original, modified }) => {
            const first = original ?? modified;
            if (!first) return null;
            return (
              <details key={key}>
                <summary>
                  <span>
                    <b>{first.provision}</b> · {first.document}
                  </span>
                  <small>{editTypeLabels[first.editType] ?? first.editType}</small>
                  {[original, modified].map(
                    (c) =>
                      c && (
                        <Badge
                          key={c.version}
                          variant="outline"
                          className={c.correct ? "green-tone" : "red-tone"}
                        >
                          {c.version === "original" ? "Original" : "Modified"}:{" "}
                          {c.correct ? "correct" : "miss"}
                        </Badge>
                      ),
                  )}
                </summary>
                <p className="evaluation-edit">{first.editDescription}</p>
                <div className="evaluation-quotes">
                  {[original, modified].map(
                    (c) =>
                      c && (
                        <div key={c.version}>
                          <strong>
                            {c.version === "original" ? "Original" : "Modified"} · expected{" "}
                            {c.expectedPresent ? "present" : "absent"} · AI{" "}
                            {c.aiFlagged ? "flagged" : "silent"}
                          </strong>
                          <small>
                            {c.confidence != null && `${c.confidence}% confidence · `}
                            Quote touches edited text: {yesNo(c.quoteTouchesEdit)} · Keyword-only
                            correct: {yesNo(c.keywordCorrect)}
                          </small>
                          <p>{c.aiQuote || "No finding"}</p>
                          {c.diagnosis && (
                            <p className="evaluation-diagnosis">
                              <b>Diagnosis:</b> {c.diagnosis}
                            </p>
                          )}
                        </div>
                      ),
                  )}
                </div>
              </details>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}

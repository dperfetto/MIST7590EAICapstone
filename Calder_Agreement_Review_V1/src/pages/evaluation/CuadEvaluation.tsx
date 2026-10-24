import { type EvaluationOutcome, type EvaluationRun } from "@/lib/model";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const outcomeLabels: Record<EvaluationOutcome, string> = {
  found: "Found",
  missed: "Missed",
  wrong_flag: "Wrong flag",
  correctly_silent: "Correctly silent",
};
const outcomeTone: Record<EvaluationOutcome, string> = {
  found: "green-tone",
  missed: "red-tone",
  wrong_flag: "amber-tone",
  correctly_silent: "",
};
const share = (n: number, d: number) =>
  d ? `${n} of ${d} (${Math.round((n / d) * 100)}%)` : "n/a";
// Same rule of thumb as evaluation/build_ai_check_set_report.py.
function evaluationReading(found: number, labeled: number, wrong: number, flagged: number) {
  if (labeled < 5) return "Too few labeled examples to judge";
  const recall = found / labeled;
  const falseRate = flagged ? wrong / flagged : 0;
  if (recall >= 0.8 && falseRate <= 0.2) return "Reliable";
  if (recall >= 0.8) return "Finds most, but over-flags";
  if (falseRate <= 0.2) return "Precise, but misses often";
  return "Misses often and over-flags";
}
/** Sections 6.1/6.2: CUAD contracts scored per provision against expert labels. */
export function CuadEvaluation({ runs }: { runs: EvaluationRun[] }) {
  const [runId, setRunId] = useState(runs[0]?.id ?? ""),
    [provision, setProvision] = useState<string | null>(null),
    [outcome, setOutcome] = useState<"all" | EvaluationOutcome>("all");
  const run = runs.find((r) => r.id === runId);
  const categories = useMemo(() => {
    if (!run) return [];
    const names = [...new Set(run.results.map((r) => r.provision))];
    return names.map((name) => {
      const rows = run.results.filter((r) => r.provision === name);
      const labeled = rows.filter((r) => r.expertPresent).length;
      const flagged = rows.filter((r) => r.calderFlagged).length;
      const found = rows.filter((r) => r.outcome === "found").length;
      const wrong = rows.filter((r) => r.outcome === "wrong_flag").length;
      const kwFlagged = rows.filter((r) => r.keywordFlagged).length;
      const kwFound = rows.filter((r) => r.keywordFlagged && r.expertPresent).length;
      return {
        name,
        labeled,
        flagged,
        found,
        wrong,
        kwFlagged,
        kwFound,
        kwWrong: kwFlagged - kwFound,
        reading: evaluationReading(found, labeled, wrong, flagged),
      };
    });
  }, [run]);
  if (!run)
    return (
      <Card>
        <CardHeader>
          <CardTitle>No evaluation results yet</CardTitle>
          <p>
            Results come from the offline check set in{" "}
            <code>evaluation/run_ai_check_set.mjs</code>. Build the report with{" "}
            <code>--sql</code>, then paste the generated SQL file into the Supabase
            SQL Editor. Demo mode has no evaluation results.
          </p>
        </CardHeader>
      </Card>
    );
  const detail = run.results.filter(
    (r) =>
      r.provision === provision &&
      (outcome === "all" ? r.outcome !== "correctly_silent" : r.outcome === outcome),
  );
  return (
    <>
      <Card>
        <CardHeader className="table-tools">
          <div>
            <CardTitle>{run.label}</CardTitle>
            <p>
              {run.contracts} contracts · {run.aiCalls} AI calls ·{" "}
              {run.aiFallbacks
                ? `${run.aiFallbacks} fell back to keyword matching`
                : "no AI fallbacks"}{" "}
              · answer key: CUAD expert labels
            </p>
          </div>
          {runs.length > 1 && (
            <Select
              value={runId}
              onValueChange={(id) => {
                setRunId(id);
                setProvision(null);
              }}
            >
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
        <CardContent className="evaluation-table">
          <div className="evaluation-head">
            <span>Provision</span>
            <span>Finds what is there</span>
            <span>Flags that are wrong</span>
            <span>Reading</span>
            <span>Keyword-only (finds / wrong)</span>
          </div>
          {categories.map((c) => (
            <button
              key={c.name}
              className={provision === c.name ? "selected" : ""}
              onClick={() => {
                setProvision(c.name);
                setOutcome("all");
              }}
            >
              <b>{c.name}</b>
              <span data-label="Finds what is there">
                {share(c.found, c.labeled)}
                <Progress value={c.labeled ? (c.found / c.labeled) * 100 : 0} />
              </span>
              <span data-label="Flags that are wrong">
                {share(c.wrong, c.flagged)}
                <Progress
                  className="wrong"
                  value={c.flagged ? (c.wrong / c.flagged) * 100 : 0}
                />
              </span>
              <Badge
                variant="outline"
                className={
                  c.reading === "Reliable"
                    ? "green-tone"
                    : c.reading.startsWith("Misses often and")
                      ? "red-tone"
                      : "amber-tone"
                }
              >
                {c.reading}
              </Badge>
              <small data-label="Keyword-only (finds / wrong)">
                {share(c.kwFound, c.labeled)} / {share(c.kwWrong, c.kwFlagged)}
              </small>
            </button>
          ))}
          <p className="evaluation-note">
            Each number is per contract: “finds what is there” is contracts Calder
            flagged out of contracts the experts labeled; “flags that are wrong” is
            flagged contracts with no expert label. No single overall accuracy is
            shown, by design. Select a provision to see each contract.
          </p>
        </CardContent>
      </Card>
      {provision && (
        <Card>
          <CardHeader className="table-tools">
            <div>
              <CardTitle>{provision}</CardTitle>
              <p>Calder's quote beside the expert-labeled clause, per contract</p>
            </div>
            <Select
              value={outcome}
              onValueChange={(v) => setOutcome(v as typeof outcome)}
            >
              <SelectTrigger className="status-filter" aria-label="Filter by outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Found, missed, and wrong flags</SelectItem>
                {(Object.keys(outcomeLabels) as EvaluationOutcome[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {outcomeLabels[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="evaluation-detail">
            {detail.length ? (
              detail.map((r) => (
                <details key={r.contract}>
                  <summary>
                    <Badge variant="outline" className={outcomeTone[r.outcome]}>
                      {outcomeLabels[r.outcome]}
                    </Badge>
                    <span>{r.contract}</span>
                    {r.confidence != null && <small>{r.confidence}% confidence</small>}
                    {r.quoteOverlaps === false && (
                      <small className="evaluation-warn">quotes a different clause</small>
                    )}
                  </summary>
                  <div className="evaluation-quotes">
                    <div>
                      <strong>Calder quote</strong>
                      <p>{r.calderQuote || "No finding"}</p>
                    </div>
                    <div>
                      <strong>Expert-labeled clause</strong>
                      <p>{r.expertClause || "Labeled absent"}</p>
                    </div>
                  </div>
                </details>
              ))
            ) : (
              <p className="evaluation-note">No contracts with this outcome.</p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { type EvaluationRun } from "@/lib/model";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CuadEvaluation } from "@/pages/evaluation/CuadEvaluation";
import { IndependentCheckEvaluation } from "@/pages/evaluation/IndependentCheckEvaluation";

/**
 * Administrator-only view of AI evaluation runs (brief Sections 6.1/6.2):
 * for each provision, how often Calder finds what the expert labels say is
 * there, and how often its flags are wrong. No overall accuracy is shown.
 */
export function Evaluation() {
  const [runs, setRuns] = useState<EvaluationRun[] | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState<"cuad" | "independent">("cuad");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/evaluations")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Could not load evaluation results.");
        return j as EvaluationRun[];
      })
      .then((loaded) => !cancelled && setRuns(loaded))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);
  if (error)
    return (
      <Card>
        <CardContent className="evaluation-empty" role="alert">
          {error}
        </CardContent>
      </Card>
    );
  if (!runs)
    return (
      <div className="loading">
        <div className="loader" />
        <p>Loading evaluation results…</p>
      </div>
    );
  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="playbook-tabs">
          <TabsTrigger value="cuad">CUAD check set</TabsTrigger>
          <TabsTrigger value="independent">Independent check</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "cuad" ? (
        <CuadEvaluation runs={runs.filter((r) => r.kind === "cuad_check_set")} />
      ) : (
        <IndependentCheckEvaluation runs={runs.filter((r) => r.kind === "independent_check")} />
      )}
    </>
  );
}

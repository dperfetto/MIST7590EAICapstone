import { type Agreement, type Data, type Finding } from "@/workspace/types";
import { type UserRole } from "@/lib/model";
import { useState } from "react";
import { formatDueDate, label, tone } from "@/workspace/format";
import { Badge } from "@/components/ui/badge";
import { AgreementDocument } from "@/pages/review-queue/AgreementDocument";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { ManualFinding } from "@/pages/review-queue/ManualFinding";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function Queue({
  data,
  selected,
  setSelected,
  decide,
  busy,
  role,
}: {
  data: Data;
  selected?: Agreement;
  setSelected: (s: string) => void;
  decide: (b: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  role: UserRole;
}) {
  const [active, setActive] = useState<Finding | null>(null),
    [decision, setDecision] = useState("accepted"),
    [reason, setReason] = useState(""),
    [queueTab, setQueueTab] = useState<"pending" | "completed">("pending");
  const completedAgreements = data.agreements.filter((agreement) => {
    const agreementFindings = data.findings.filter(
      (finding) => finding.agreementId === agreement.id,
    );
    return (
      agreement.status?.startsWith("cleared") ||
      (agreementFindings.length > 0 &&
        agreementFindings.every((finding) =>
          ["accepted", "dismissed"].includes(finding.status),
        ))
    );
  });
  const completedIds = new Set(completedAgreements.map((agreement) => agreement.id));
  const queueAgreements = data.agreements.filter(
    (agreement) => !completedIds.has(agreement.id),
  );
  const visibleAgreements =
    queueTab === "completed" ? completedAgreements : queueAgreements;
  const current =
    visibleAgreements.find((agreement) => agreement.id === selected?.id) ??
    visibleAgreements[0];
  const fs = current
    ? data.findings.filter((finding) => finding.agreementId === current.id)
    : [];

  return (
    <div className="review-layout">
      <aside className="queue-list">
        <div className="queue-filter">
          <strong>Review queue</strong>
          <span>
            {visibleAgreements.length} agreements
          </span>
        </div>
        <div className="queue-tabs" role="tablist" aria-label="Review status">
          <button
            type="button"
            role="tab"
            aria-selected={queueTab === "pending"}
            aria-controls="review-queue-panel"
            onClick={() => setQueueTab("pending")}
          >
            To be reviewed <span>{queueAgreements.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={queueTab === "completed"}
            aria-controls="review-queue-panel"
            onClick={() => setQueueTab("completed")}
          >
            Completed reviews <span>{completedAgreements.length}</span>
          </button>
        </div>
        <div id="review-queue-panel" role="tabpanel" className="queue-items">
        {visibleAgreements.map((a) => (
            <button
              className={current?.id === a.id ? "selected" : ""}
              key={a.id}
              onClick={() => setSelected(a.id)}
            >
              <span
                className={`risk-line ${data.findings.some((f) => f.agreementId === a.id && f.confidence < 85) ? "red" : "amber"}`}
              />
              <div>
                <strong>{a.vendor}</strong>
                <small>
                  {a.id} · {a.agreementType}
                </small>
                <small>
                  Needed{" "}
                  {formatDueDate(a.neededBy, {
                    month: "short",
                    day: "numeric",
                  })}
                </small>
              </div>
              <Badge variant="outline" className={tone(a.status)}>
                {label(a.status)}
              </Badge>
            </button>
          ))}
          {!visibleAgreements.length && (
            <p className="queue-list-empty">
              {queueTab === "pending"
                ? "No agreements are waiting for review."
                : "No completed reviews yet."}
            </p>
          )}
        </div>
      </aside>
      {current ? (
      <section className="review-detail">
        <div className="review-title">
          <div>
            <span>
              {current.id} · {current.agreementType}
            </span>
            <h2>{current.vendor}</h2>
            <p>
              {current.filename} · {current.businessUnit} ·{" "}
              {current.playbookVersion}
            </p>
          </div>
          <Badge
            variant="outline"
            className={completedIds.has(current.id) ? "green-tone" : tone(current.status)}
          >
            {completedIds.has(current.id) ? "Review complete" : label(current.status)}
          </Badge>
        </div>
        <div className="summary-strip">
          <span>
            <b>{fs.length}</b> provisions
          </span>
          <span>
            <b>{fs.filter((f) => f.status === "open").length}</b> awaiting
            disposition
          </span>
          <span>
            <b>{fs.filter((f) => f.confidence < 85).length}</b> verify
            confidence
          </span>
        </div>
        <AgreementDocument key={`doc-${current.id}`} agreement={current} />
        <div className="finding-stack">
          {fs.length ? (
            fs.map((f) => (
              <article
                className={`finding ${f.status !== "open" ? "resolved" : ""}`}
                key={f.id}
              >
                <div className="finding-top">
                  <div>
                    <Badge variant="outline" className="green-tone">
                      Provision identified
                    </Badge>
                    <Badge variant="outline" className="method-badge">
                      {label(f.analysisMethod || "manual")}
                    </Badge>
                    <strong>{f.provision}</strong>
                  </div>
                  <div className="confidence">
                    <span>{f.confidence}% confidence</span>
                    <Progress value={f.confidence} />
                  </div>
                </div>
                <p className="reason">{f.reason}</p>
                <blockquote>
                  <span>SOURCE TEXT</span>“{f.sourceText}”
                </blockquote>
                {f.status === "open" || (f.status === "escalated" && ["approver", "administrator"].includes(role)) ? (
                  <Button
                    onClick={() => {
                      setActive(f);
                      setDecision("accepted");
                      setReason("");
                    }}
                  >
                    {f.status === "escalated" ? "Resolve escalation" : "Review finding"}
                  </Button>
                ) : (
                  <div className="decision">
                    <CheckCircle2 size={17} />
                    <span>
                      {label(f.status)} — {f.decisionReason}
                    </span>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="empty">
              <CheckCircle2 />
              <h3>No findings yet</h3>
              <p>Add a manual finding while automated analysis is pending.</p>
            </div>
          )}
        </div>
        {!completedIds.has(current.id) && (
          <ManualFinding key={current.id} agreement={current} submit={decide} />
        )}
      </section>
      ) : (
        <div className="queue-empty-state" role="status">
          <CheckCircle2 size={34} />
          <div>
            <h2>
              {queueTab === "pending"
                ? "No agreements are waiting for review"
                : "No completed reviews yet"}
            </h2>
            <p>
              {queueTab === "pending"
                ? "The queue will populate after a Submitter uploads an agreement or routes an agreement to guided manual review."
                : "A review appears here after every finding has been accepted or dismissed, or the agreement has been cleared."}
            </p>
          </div>
        </div>
      )}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disposition: {active?.provision}</DialogTitle>
            <DialogDescription>
              Your decision and reason become part of the permanent audit
              record.
            </DialogDescription>
          </DialogHeader>
          <div className="decision-form">
            <Label>Decision</Label>
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accepted">Accept finding</SelectItem>
                <SelectItem value="dismissed">Dismiss finding</SelectItem>
                {/* An escalation can only be resolved, not escalated again. */}
                {active?.status !== "escalated" && (
                  <SelectItem value="escalated">Escalate to Approver</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Label>Required reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the basis for this decision…"
              aria-invalid={!reason.trim()}
            />
            {!reason.trim() && (
              <p className="field-error" role="alert">
                Enter a reason before recording this decision.
              </p>
            )}
            <Button
              disabled={busy || !reason.trim()}
              onClick={async () => {
                if (
                  active &&
                  reason.trim() &&
                  (await decide({
                    action: "decide_finding",
                    findingId: active.id,
                    decision,
                    reason: reason.trim(),
                  }))
                )
                  setActive(null);
              }}
            >
              Record decision
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { roleLabels, type UserRole } from "@/lib/data";
import { type Agreement, type Data } from "@/workspace/types";
import { useState } from "react";
import { formatDueDate, label, parseDueDate, tone } from "@/workspace/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, FileText, Gavel, Plus, ShieldCheck } from "lucide-react";
import { Kpi } from "@/components/Kpi";
import { DueChip } from "@/components/DueChip";
import { Badge } from "@/components/ui/badge";

const statusGuide: { status: string; meaning: string; next: string }[] = [
  {
    status: "ready_for_review",
    meaning: "Analysis finished and flags are waiting to be checked.",
    next: "Reviewer",
  },
  {
    status: "manual_review_required",
    meaning:
      "There are no automated findings (manual mode, analysis unavailable, or nothing matched), so provisions must be identified by hand.",
    next: "Reviewer",
  },
  {
    status: "in_review",
    meaning: "Some flags have been decided; others are still open.",
    next: "Reviewer",
  },
  {
    status: "escalated",
    meaning: "A reviewer sent at least one flag up for a final decision.",
    next: "Approver",
  },
  {
    status: "review_complete",
    meaning: "Every flag was accepted or dismissed.",
    next: "No one — finished",
  },
  {
    status: "approved",
    meaning: "Every flag was accepted.",
    next: "No one — finished",
  },
  {
    status: "cleared_with_conditions",
    meaning: "An approver cleared the agreement with conditions noted.",
    next: "No one — finished",
  },
];
type GuideStep = { title: string; detail: string; view?: string; action?: string };
const gettingStarted: Record<UserRole, GuideStep[]> = {
  submitter: [
    {
      title: "Submit an agreement",
      detail:
        "Upload a searchable PDF or TXT, choose the agreement type, and set a needed-by date so reviewers can prioritize it.",
      view: "intake",
      action: "New intake",
    },
    {
      title: "Track its status",
      detail:
        "The Agreements page shows where each of your submissions is in review.",
      view: "agreements",
      action: "Agreements",
    },
    {
      title: "Wait for a human decision",
      detail:
        "A reviewer checks every flag against the contract text. You'll see the status change to Review Complete or Approved.",
    },
  ],
  reviewer: [
    {
      title: "Open the review queue",
      detail: "Start with the agreements due soonest — the list below is already in that order.",
      view: "queue",
      action: "Review queue",
    },
    {
      title: "Check each flag's source text",
      detail:
        "Read the quoted clause and confirm it really is the named provision. Add a manual finding if something was missed.",
    },
    {
      title: "Accept, dismiss, or escalate",
      detail:
        "Every decision needs a reason and is written to the audit log. Escalate when an approver should decide.",
      view: "audit",
      action: "Audit log",
    },
  ],
  approver: [
    {
      title: "Resolve escalations",
      detail:
        "The Awaiting approver tile counts agreements a reviewer escalated. Open them from the review queue.",
      view: "queue",
      action: "Review queue",
    },
    {
      title: "Set the final disposition",
      detail:
        "Your decision and its reason close the escalation and become part of the audit record.",
    },
    {
      title: "Watch the trends",
      detail: "Reporting shows provision frequency and overdue work across business units.",
      view: "reports",
      action: "Reporting",
    },
  ],
  administrator: [
    {
      title: "Check the playbooks",
      detail:
        "Playbooks control which provisions are looked for in each agreement type.",
      view: "playbook",
      action: "Playbooks",
    },
    {
      title: "Assign roles",
      detail:
        "Give people the submitter, reviewer, or approver role so they see the right work.",
      view: "profile",
      action: "Profile & access",
    },
    {
      title: "Review like everyone else",
      detail: "Administrators can also work the review queue and resolve escalations.",
      view: "queue",
      action: "Review queue",
    },
  ],
};
const guideDismissedKey = (email: string) =>
  `calder-getting-started-dismissed:${email}`;
const readGuideDismissed = (email: string) => {
  try {
    return localStorage.getItem(guideDismissedKey(email)) === "1";
  } catch {
    return false;
  }
};
const writeGuideDismissed = (email: string, dismissed: boolean) => {
  try {
    if (dismissed) localStorage.setItem(guideDismissedKey(email), "1");
    else localStorage.removeItem(guideDismissedKey(email));
  } catch {
    // Storage can be blocked; the guide simply reappears next visit.
  }
};
export function Overview({
  data,
  onQueue,
  onSelect,
  onNavigate,
}: {
  data: Data;
  onQueue: () => void;
  onSelect: (id: string) => void;
  onNavigate: (view: string) => void;
}) {
  const [guideDismissed, setGuideDismissed] = useState(() =>
    readGuideDismissed(data.me.email),
  );
  const setGuide = (dismissed: boolean) => {
    writeGuideDismissed(data.me.email, dismissed);
    setGuideDismissed(dismissed);
  };
  const open = data.findings.filter((f) => f.status === "open"),
    lowConfidence = open.filter((f) => f.confidence < 85);
  const activeReview = data.agreements.filter((a) =>
      ["in_review", "ready_for_review", "manual_review_required"].includes(
        a.status,
      ),
    ),
    activeUnits = new Set(activeReview.map((a) => a.businessUnit)).size;
  // Soonest needed-by date first; agreements without a valid date go last.
  // Ties go to the agreement with the lowest-confidence open finding.
  const dueTime = (a: Agreement) =>
      parseDueDate(a.neededBy)?.getTime() ?? Infinity,
    lowestConfidence = (a: Agreement) =>
      Math.min(
        100,
        ...open.filter((f) => f.agreementId === a.id).map((f) => f.confidence),
      );
  const priority = data.agreements
    .filter(
      (a) =>
        !a.status.startsWith("cleared") &&
        !["approved", "review_complete"].includes(a.status),
    )
    .sort(
      (a, b) =>
        dueTime(a) - dueTime(b) || lowestConfidence(a) - lowestConfidence(b),
    );
  const steps = gettingStarted[data.me.role];
  return (
    <>
      {!guideDismissed && (
        <Card className="getting-started">
          <CardHeader className="card-head">
            <div>
              <CardTitle>Getting started as {roleLabels[data.me.role]}</CardTitle>
              <p>Three steps to your first review.</p>
            </div>
            <Button variant="ghost" onClick={() => setGuide(true)}>
              Hide guide
            </Button>
          </CardHeader>
          <CardContent>
            <ol className="guide-steps">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <span className="guide-number">{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                    {step.view && step.action && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigate(step.view!)}
                      >
                        {step.action} <ChevronRight size={14} />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
      <section className="kpis">
        <Kpi
          label="In active review"
          value={activeReview.length}
          note={
            activeUnits
              ? `Across ${activeUnits} business ${activeUnits === 1 ? "unit" : "units"}`
              : "Nothing in progress"
          }
          icon={Clock3}
        />
        <Kpi
          label="Low-confidence open"
          value={lowConfidence.length}
          note="Human verification prioritized"
          icon={AlertTriangle}
          danger
        />
        <Kpi
          label="Awaiting approver"
          value={data.agreements.filter((a) => a.status === "escalated").length}
          note="Final disposition needed"
          icon={Gavel}
        />
        <Kpi
          label="Approved or cleared"
          value={
            data.agreements.filter(
              (a) => a.status === "approved" || a.status.startsWith("cleared"),
            ).length
          }
          note="Includes cleared with conditions"
          icon={CheckCircle2}
        />
      </section>
      <Card>
        <CardHeader className="card-head">
          <div>
            <CardTitle>Priority queue</CardTitle>
            <p>Soonest needed-by date first, then lowest confidence</p>
          </div>
          <Button variant="outline" onClick={onQueue}>
            Open queue <ChevronRight size={15} />
          </Button>
        </CardHeader>
        <CardContent className="rows">
          {priority.length === 0 && (
            <div className="overview-empty" role="status">
              <CheckCircle2 size={22} />
              <div>
                <strong>Nothing needs review right now.</strong>
                <span>
                  New agreements appear here as soon as they are submitted,
                  soonest due first.
                </span>
              </div>
              <Button onClick={() => onNavigate("intake")}>
                <Plus size={16} /> Submit an agreement
              </Button>
            </div>
          )}
          {priority
            .slice(0, 4)
            .map((a) => {
              const fs = data.findings.filter(
                (f) => f.agreementId === a.id && f.status === "open",
              );
              return (
                <button
                  className="agreement-row"
                  key={a.id}
                  onClick={() => onSelect(a.id)}
                >
                  <div className="file-icon">
                    <FileText size={18} />
                  </div>
                  <div className="row-main">
                    <strong>
                      {a.vendor} <DueChip neededBy={a.neededBy} />
                    </strong>
                    <span>
                      {a.id} · {a.agreementType} · {a.businessUnit}
                    </span>
                  </div>
                  <div>
                    <Badge variant="outline" className={tone(a.status)}>
                      {label(a.status)}
                    </Badge>
                    <span className="due">
                      Due{" "}
                      {formatDueDate(a.neededBy, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <strong
                    className={
                      fs.some((f) => f.confidence < 85)
                        ? "risk-high"
                        : "risk-neutral"
                    }
                  >
                    {fs.length} {fs.length === 1 ? "flag" : "flags"}
                  </strong>
                  <ChevronRight size={17} />
                </button>
              );
            })}
        </CardContent>
      </Card>
      <Card className="overview-help">
        <CardHeader>
          <CardTitle>How to read this page</CardTitle>
        </CardHeader>
        <CardContent>
          <details>
            <summary>What a flag and its confidence mean</summary>
            <div className="help-body">
              <p>
                A <strong>flag</strong> means Calder found language that looks
                like a named provision, such as a liability cap or an
                auto-renewal clause, and quotes the text it found. It is not a
                risk rating or legal advice. If a provision isn't flagged, that
                doesn't prove the contract lacks it.
              </p>
              <ul>
                <li>
                  <strong>90</strong> — the AI and the keyword rules both found
                  this provision.
                </li>
                <li>
                  <strong>75</strong> — only the AI found it.
                </li>
                <li>
                  <strong>64–96</strong> — found by keyword rules alone; higher
                  means more matching phrases.
                </li>
                <li>
                  <strong>Manual findings</strong> use the confidence the
                  reviewer entered.
                </li>
                <li>
                  <strong>Below 85</strong> is counted as low confidence and
                  deserves a closer look.
                </li>
              </ul>
            </div>
          </details>
          <details>
            <summary>What each status means</summary>
            <div className="help-body status-guide">
              {statusGuide.map((row) => (
                <div key={row.status}>
                  <Badge variant="outline" className={tone(row.status)}>
                    {label(row.status)}
                  </Badge>
                  <span>{row.meaning}</span>
                  <small>Next: {row.next}</small>
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>
      <div className="notice notice-footer">
        <ShieldCheck size={21} />
        <div>
          <strong>Human review remains the decision point.</strong>
          <span>
            Every automated finding includes its source and confidence. Manual
            classification remains available if analysis fails.
          </span>
        </div>
        {guideDismissed && (
          <Button variant="outline" size="sm" onClick={() => setGuide(false)}>
            Show getting-started guide
          </Button>
        )}
      </div>
    </>
  );
}

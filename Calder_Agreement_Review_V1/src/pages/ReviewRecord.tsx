import { type Agreement, type Audit, type Finding, type FindingComment } from "@/workspace/types";
import { type UserRole } from "@/lib/model";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAgreementActivity } from "@/lib/queries";
import { decisionTrail } from "@/lib/reviewRecord";
import { formatDueDate, label, tone } from "@/workspace/format";

const dateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
const DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, DAY);
const foundBy: Record<string, string> = { ai: "AI analysis", deterministic: "keyword analysis", manual: "a reviewer (manual finding)" };

/** A completed agreement's review, laid out to read on screen and to print. */
export function ReviewRecord({
  agreement,
  findings,
  comments,
  role,
  onBack,
}: {
  agreement: Agreement;
  findings: Finding[];
  comments: FindingComment[];
  role: UserRole;
  onBack: () => void;
}) {
  const [activity, setActivity] = useState<Audit[] | null>(null);
  const [activityError, setActivityError] = useState("");
  useEffect(() => {
    let current = true;
    getAgreementActivity(agreement.id)
      .then((events) => current && setActivity(events))
      .catch((error) => current && setActivityError(error instanceof Error ? error.message : "Could not load activity."));
    return () => {
      current = false;
    };
  }, [agreement.id]);
  const own = findings.filter((f) => f.agreementId === agreement.id);
  const events = activity ?? [];
  const details: [string, string][] = [
    ["Agreement", agreement.id],
    ["File", agreement.filename],
    ["Type", agreement.agreementType],
    ["Business unit", agreement.businessUnit],
    ["Submitted", date(agreement.createdAt)],
    ["Needed by", formatDueDate(agreement.neededBy, DAY)],
    ["Reviewed under", agreement.playbookVersion],
    ["Printed", date(new Date().toISOString())],
  ];
  return (
    <div className="review-record-page">
      <div className="review-record-toolbar no-print">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={16} /> Back to agreements
        </Button>
        <Button onClick={() => window.print()} disabled={activity === null && !activityError}>
          <Printer size={16} /> Print
        </Button>
      </div>
      <article className="review-record">
        <header>
          <span className="review-record-eyebrow">Review record</span>
          <h2>{agreement.vendor}</h2>
          <Badge variant="outline" className={tone(agreement.status)}>
            {label(agreement.status)}
          </Badge>
        </header>
        <dl className="review-record-details">
          {details.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <section>
          <h3>Findings and decisions</h3>
          {own.length === 0 && <p className="review-record-muted">No provisions were flagged for this agreement.</p>}
          {own.map((finding) => {
            const thread = comments.filter((c) => c.findingId === finding.id);
            return (
              <div className="review-record-finding" key={finding.id}>
                <div className="review-record-finding-head">
                  <strong>{finding.provision}</strong>
                  <Badge variant="outline" className={tone(finding.status)}>
                    {label(finding.status)}
                  </Badge>
                </div>
                <blockquote>{finding.sourceText}</blockquote>
                {finding.analysisMethod && foundBy[finding.analysisMethod] && (
                  <p className="review-record-muted">
                    Found by {foundBy[finding.analysisMethod]}
                    {finding.analysisMethod !== "manual" && ` · confidence ${finding.confidence}`}
                  </p>
                )}
                <ol className="review-record-trail">
                  {decisionTrail(finding, own, events).map((step, index) => (
                    <li key={index}>
                      <b>{label(step.status)}</b>
                      {step.actor && ` by ${step.actor}`}
                      {step.date && ` · ${dateTime(step.date)}`}
                      {step.reason && <span>{step.reason}</span>}
                    </li>
                  ))}
                </ol>
                {thread.length > 0 && (
                  <div className="review-record-comments">
                    <h4>Comments</h4>
                    {thread.map((c) => (
                      <p key={c.id}>
                        <b>{c.authorName}</b> ({label(c.authorRole)}) · {dateTime(c.createdAt)}
                        <span>{c.body}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section>
          <h3>Activity</h3>
          {activityError && <p className="review-record-muted">Activity could not be loaded: {activityError}</p>}
          {!activityError && activity === null && <p className="review-record-muted">Loading activity…</p>}
          {activity?.length === 0 && <p className="review-record-muted">No activity is recorded for this agreement.</p>}
          {events.length > 0 && (
            <table className="review-record-activity">
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{dateTime(event.createdAt)}</td>
                    <td>{event.actorName}</td>
                    <td>
                      <b>{event.eventType}</b>
                      <span>{event.detail}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {role === "submitter" && (
            <p className="review-record-muted">Activity shows the events you recorded; decisions are listed with each finding above.</p>
          )}
        </section>
      </article>
    </div>
  );
}

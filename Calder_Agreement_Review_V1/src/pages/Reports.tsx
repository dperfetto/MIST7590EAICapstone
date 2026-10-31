import { type Data } from "@/workspace/types";
import { Kpi } from "@/components/Kpi";
import { AlertTriangle, FileText, Gavel, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agreementTypes } from "@/lib/model";
import { formatHours, reviewHealth, reviewTimes } from "@/lib/reviewMetrics";
import { type CSSProperties } from "react";

export function Reports({ data }: { data: Data }) {
  const categories = [...new Set(data.findings.map((f) => f.provision))];
  const health = reviewHealth(data.agreements, data.findings);
  const times = reviewTimes(data.agreements, data.findings);
  return (
    <>
      <section className="kpis">
        <Kpi
          label="Total agreements"
          value={data.agreements.length}
          note="Current demonstration set"
          icon={FileText}
        />
        <Kpi
          label="Open findings"
          value={data.findings.filter((f) => f.status === "open").length}
          note="Awaiting human decision"
          icon={AlertTriangle}
        />
        <Kpi
          label="Escalated"
          value={data.findings.filter((f) => f.status === "escalated").length}
          note="Approver queue"
          icon={Gavel}
        />
        <Kpi
          label="Decisions recorded"
          value={data.findings.filter((f) => f.status !== "open").length}
          note="Durable audit history"
          icon={ShieldCheck}
        />
      </section>
      <div className="report-grid">
        <Card>
          <CardHeader>
            <CardTitle>Agreements by type</CardTitle>
          </CardHeader>
          <CardContent>
            {agreementTypes.map((t) => {
              const n = data.agreements.filter(
                (a) => a.agreementType === t,
              ).length;
              return (
                <div className="bar-row" key={t}>
                  <span>{t}</span>
                  <div>
                    <i
                      style={{
                        width: `${Math.max(8, (n / data.agreements.length) * 100)}%`,
                      }}
                    />
                  </div>
                  <b>{n}</b>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Provision frequency</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.map((c) => {
              const n = data.findings.filter((f) => f.provision === c).length;
              return (
                <div className="bar-row" key={c}>
                  <span>{c}</span>
                  <div>
                    <i
                      className="orange"
                      style={{ width: `${(n / data.findings.length) * 100}%` }}
                    />
                  </div>
                  <b>{n}</b>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Review health</CardTitle>
            <p>Open agreements against their needed-by date</p>
          </CardHeader>
          <CardContent>
            <div
              className="donut"
              style={{ "--within-target": `${health.percentWithinTarget ?? 0}%` } as CSSProperties}
            >
              <div>
                <strong>{health.percentWithinTarget === null ? "—" : `${health.percentWithinTarget}%`}</strong>
                <span>within target</span>
              </div>
            </div>
            <div className="health-list">
              <span>
                <i className="dot green" />
                Within target <b>{health.withinTarget}</b>
              </span>
              <span>
                <i className="dot amber" />
                Due within 2 days <b>{health.dueSoon}</b>
              </span>
              <span>
                <i className="dot red" />
                Overdue <b>{health.overdue}</b>
              </span>
            </div>
            <dl className="health-key">
              <div>
                <dt><i className="dot green" />Green</dt>
                <dd>Needed-by date is 3 or more days away.</dd>
              </div>
              <div>
                <dt><i className="dot amber" />Amber</dt>
                <dd>Due today, tomorrow or the day after. Prioritize these.</dd>
              </div>
              <div>
                <dt><i className="dot red" />Red</dt>
                <dd>The needed-by date has passed.</dd>
              </div>
              <p>
                Only open reviews are counted; finished reviews drop out. The percentage is green out of all open
                agreements.
              </p>
            </dl>
          </CardContent>
        </Card>
      </div>
      <Card className="review-times-card">
        <CardHeader>
          <CardTitle>Review times</CardTitle>
          <p>
            From submission to the first recorded decision, and to the last
            decision on a finished review. Medians, so one slow review does not
            skew the figure.
          </p>
        </CardHeader>
        <CardContent className="review-times">
          <div className="health-list">
            <span>
              Median time to first decision <b>{formatHours(times.medianHoursToFirstDecision)}</b>
            </span>
            <span>
              Median time to complete a review <b>{formatHours(times.medianHoursToComplete)}</b>
            </span>
            <span>
              Reviews completed <b>{times.completed}</b>
            </span>
            <span>
              Longest-waiting open agreement <b>{formatHours(times.oldestOpenHours)}</b>
            </span>
          </div>
          {times.byType.length > 0 && (
            <div className="health-list">
              {times.byType.map((row) => (
                <span key={row.agreementType}>
                  {row.agreementType} ({row.completed} completed){" "}
                  <b>{formatHours(row.medianHoursToComplete)}</b>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

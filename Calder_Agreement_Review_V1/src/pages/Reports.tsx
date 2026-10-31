import { type Data } from "@/workspace/types";
import { Kpi } from "@/components/Kpi";
import { AlertTriangle, FileText, Gavel, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agreementTypes } from "@/lib/model";
import { formatHours, reviewHealth, reviewTimes } from "@/lib/reviewMetrics";
import { type CSSProperties } from "react";
import { taxonomy } from "@/lib/candidateRetrieval";
import { provisionCoverage } from "@/lib/playbookVersions";
import { vendorSummaries } from "@/lib/vendorHistory";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function Reports({ data }: { data: Data }) {
  const categories = [...new Set(data.findings.map((f) => f.provision))];
  const health = reviewHealth(data.agreements, data.findings);
  const times = reviewTimes(data.agreements, data.findings);
  const coverage = provisionCoverage(
    taxonomy.map((entry) => entry.calderProvision),
    data.agreements,
    data.findings,
    data.playbookVersions,
  );
  const vendors = vendorSummaries(data.agreements, data.findings);
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
                Due in 48 hours <b>{health.dueSoon}</b>
              </span>
              <span>
                <i className="dot red" />
                Overdue <b>{health.overdue}</b>
              </span>
            </div>
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
      <Card className="report-table-card">
        <CardHeader>
          <CardTitle>Presence identification coverage</CardTitle>
          <p>
            For each provision, how many agreements were checked for it (from the playbook version each was analyzed
            under), how many were flagged, and what reviewers decided. Checked but not flagged does not prove the
            provision is absent.
          </p>
        </CardHeader>
        <CardContent>
          <div className="report-table-scroll">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Provision</th>
                  <th>Checked in</th>
                  <th>Flagged in</th>
                  <th>Confirmed in</th>
                  <th>Dismissed flags</th>
                  <th>Awaiting decision</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((row) => (
                  <tr key={row.provision} className={row.checked ? undefined : "muted"}>
                    <th scope="row">{row.provision}</th>
                    <td>{row.checked}</td>
                    <td>
                      {row.flagged}
                      {row.checked > 0 && <span className="report-share">{Math.round((row.flagged / row.checked) * 100)}%</span>}
                    </td>
                    <td>{row.confirmed}</td>
                    <td>{row.dismissed}</td>
                    <td>{row.awaiting}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="report-table-note">
            Checked, flagged and confirmed count agreements; dismissed and awaiting count findings.
          </p>
        </CardContent>
      </Card>
      <Card className="report-table-card">
        <CardHeader>
          <CardTitle>Vendor history</CardTitle>
          <p>
            Every vendor's agreements and decisions. Names are matched the same way as in the review queue, so
            "Northstar Inc." and "Northstar" count as one vendor.
          </p>
        </CardHeader>
        <CardContent>
          {vendors.length === 0 ? (
            <p className="report-table-note">No agreements have been submitted yet.</p>
          ) : (
            <div className="report-table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Agreements</th>
                    <th>Last submitted</th>
                    <th>Provisions confirmed</th>
                    <th>Dismissed flags</th>
                    <th>Awaiting decision</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((row) => (
                    <tr key={row.vendor}>
                      <th scope="row">
                        {row.vendor}
                        <span className="report-sub">{row.agreementTypes.join(", ")}</span>
                      </th>
                      <td>{row.agreements}</td>
                      <td>{shortDate(row.lastSubmitted)}</td>
                      <td className="report-wrap">
                        {row.confirmed.length
                          ? row.confirmed
                              .map((c) => (row.agreements > 1 ? `${c.provision} (${c.agreements} of ${row.agreements})` : c.provision))
                              .join(", ")
                          : "None yet"}
                      </td>
                      <td>{row.dismissed}</td>
                      <td>{row.awaiting}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

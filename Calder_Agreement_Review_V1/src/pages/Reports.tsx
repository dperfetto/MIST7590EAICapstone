import { type Data } from "@/workspace/types";
import { daysUntilDue } from "@/workspace/format";
import { Kpi } from "@/components/Kpi";
import { AlertTriangle, FileSearch, FileText, Gavel, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agreementTypes } from "@/lib/model";

export function Reports({ data }: { data: Data }) {
  const categories = [...new Set(data.findings.map((f) => f.provision))];
  const overdue = data.agreements.filter(
    (a) =>
      (daysUntilDue(a.neededBy) ?? 0) < 0 &&
      !a.status.startsWith("cleared") &&
      !["approved", "review_complete"].includes(a.status),
  );
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
            <p>Current agreement workload</p>
          </CardHeader>
          <CardContent>
            <div className="donut">
              <div>
                <strong>78%</strong>
                <span>within target</span>
              </div>
            </div>
            <div className="health-list">
              <span>
                <i className="dot green" />
                Within target <b>7</b>
              </span>
              <span>
                <i className="dot amber" />
                Due in 48 hours <b>2</b>
              </span>
              <span>
                <i className="dot red" />
                Overdue <b>{overdue.length}</b>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Presence identification coverage</CardTitle>
          <p>What the required baseline measures and reports</p>
        </CardHeader>
        <CardContent className="empty">
          <FileSearch />
          <h3>Provision counts replace risk comparisons</h3>
          <p>
            Reports count which provisions appear most often across submitted
            agreements. Standard positions, deviations, and gap detection remain
            stretch work.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

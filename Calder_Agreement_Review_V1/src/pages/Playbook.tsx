import { type Agreement, type PlaybookVersion, type Rule } from "@/workspace/types";
import { playbookChange, versionsFor } from "@/lib/playbookVersions";
import { useState } from "react";
import { agreementTypes } from "@/lib/model";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";
import { taxonomy, taxonomyDescription } from "@/lib/candidateRetrieval";
import { Switch } from "@/components/ui/switch";

// Provisions appear in the same order for every contract type.
const provisionOrder = taxonomy.map((entry) => entry.calderProvision);
const byProvisionOrder = (a: Rule, b: Rule) =>
  provisionOrder.indexOf(a.provision) - provisionOrder.indexOf(b.provision);
export function Playbook({
  rules,
  versions,
  agreements,
  update,
}: {
  rules: Rule[];
  versions: PlaybookVersion[];
  agreements: Agreement[];
  update: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<string>(agreementTypes[0]),
    shown = rules.filter((r) => r.agreementType === tab).sort(byProvisionOrder),
    activeCount = shown.filter((r) => r.active).length,
    history = versionsFor(versions, tab),
    outdated = agreements.filter((a) => a.agreementType === tab && playbookChange(versions, a));
  return (
    <>
      <div className="section-title">
        <h2>Contract-type playbooks</h2>
        <p>
          Every contract type lists all {provisionOrder.length} provisions.
          Switch on the ones Calder should look for in that type of agreement.
          The baseline records presence, source text, and confidence only.
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="playbook-tabs">
          {agreementTypes.map((agreementType) => (
            <TabsTrigger key={agreementType} value={agreementType}>
              {agreementType}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="playbook-count">
        {activeCount} of {shown.length} provisions switched on for {tab}
      </p>
      <Card>
        <CardContent className="rule-table">
          <div className="rule-head">
            <span>Provision</span>
            <span>Presence description</span>
            <span>Active</span>
          </div>
          {shown.map((r) => (
            <div key={r.id}>
              <strong>{r.provision}</strong>
              <span>{taxonomyDescription(r.provision) || "Identify supporting clause text."}</span>
              <Switch
                checked={r.active}
                onCheckedChange={(active) =>
                  update({ action: "update_rule", ruleId: r.id, active })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="playbook-versions">
        <CardContent>
          <div className="playbook-versions-head">
            <History size={18} aria-hidden="true" />
            <strong>Version history</strong>
            <span>
              {history.length
                ? `${tab} is on v${history[0].version}. Switching a provision on or off creates the next version.`
                : "Versions are recorded once schema.sql has been rerun."}
            </span>
          </div>
          {history.length > 0 && (
            <ol>
              {history.map((v) => (
                <li key={v.version}>
                  <b>v{v.version}</b>
                  <span>{v.summary}</span>
                  <small>
                    {v.changedBy} · {new Date(v.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                    {v.activeProvisions.length} provisions
                  </small>
                </li>
              ))}
            </ol>
          )}
          {outdated.length > 0 && (
            <p className="playbook-versions-outdated">
              {outdated.length} agreement{outdated.length === 1 ? " was" : "s were"} reviewed under an earlier version (
              {outdated.map((a) => a.id).join(", ")}). Reviewers can re-evaluate {outdated.length === 1 ? "it" : "them"} from the
              review queue; earlier decisions are kept.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

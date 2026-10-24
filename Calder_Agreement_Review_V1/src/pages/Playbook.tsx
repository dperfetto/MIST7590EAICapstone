import { type Rule } from "@/workspace/types";
import { useState } from "react";
import { agreementTypes } from "@/lib/model";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HelpCircle, Settings2 } from "lucide-react";
import { taxonomyDescription } from "@/lib/candidateRetrieval";
import { Switch } from "@/components/ui/switch";

const detectionMethodDefinitions = [
  {
    name: "Regex",
    description:
      "Deterministic keywords and text patterns identify predictable clause language without AI.",
  },
  {
    name: "AI",
    description:
      "A general-purpose model interprets flexible contract language and must return supporting text from the document.",
  },
  {
    name: "Hybrid",
    description:
      "Deterministic retrieval finds likely clauses, then AI evaluates the candidate language.",
  },
  {
    name: "Regex + AI",
    description:
      "A hybrid variation where regex finds structured language and AI interprets its surrounding meaning.",
  },
  {
    name: "Manual fallback",
    description:
      "A reviewer selects the provision and source text when automation is unavailable or needs correction.",
  },
] as const;
export function Playbook({
  rules,
  update,
}: {
  rules: Rule[];
  update: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<string>(agreementTypes[0]),
    shown = rules.filter((r) => r.agreementType === tab);
  return (
    <>
      <div className="section-title">
        <h2>Contract-type playbooks</h2>
        <p>
          Contract type selects the provision categories to identify. The
          baseline records presence, source text, and confidence only.
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
      <Card>
        <CardContent className="rule-table">
          <div className="rule-head">
            <span>Provision</span>
            <span>Presence description</span>
            <span className="rule-head-method">
              Method
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" className="method-guide-trigger">
                    <HelpCircle size={14} />
                    What do these methods mean?
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Detection method guide</DialogTitle>
                    <DialogDescription>
                      These methods describe how Calder can identify presence. They do
                      not determine whether contract language is acceptable.
                    </DialogDescription>
                  </DialogHeader>
                  <dl className="method-guide-list">
                    {detectionMethodDefinitions.map((method) => (
                      <div key={method.name}>
                        <dt>{method.name}</dt>
                        <dd>{method.description}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="method-guide-footnote">
                    Automatic mode attempts hosted analysis with deterministic
                    corroboration. If the hosted service is unavailable, Calder runs the
                    deterministic path automatically; manual review remains available at
                    all times.
                  </p>
                </DialogContent>
              </Dialog>
            </span>
            <span>Active</span>
          </div>
          {shown.map((r) => (
            <div key={r.id}>
              <strong>{r.provision}</strong>
              <span>{taxonomyDescription(r.provision) || "Identify supporting clause text."}</span>
              <span>{r.method}</span>
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
      <div className="playbook-note">
        <Settings2 size={20} />
        <div>
          <strong>Presence-only baseline</strong>
          <span>
            Prior standard-position, severity, deviation, and gap work is
            preserved as disabled stretch-backlog metadata. It is not used to
            create baseline findings.
          </span>
        </div>
      </div>
    </>
  );
}

import { agreementTypes, type Data } from "@/lib/model";
import { taxonomy } from "@/lib/candidateRetrieval";

const LOCAL_KEY = "calder-demo-v1-12";
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const seed: Data = {
  me: {
    id: "demo-admin",
    name: "Jordan Lee",
    email: "demo.admin@calder.example",
    role: "administrator",
  },
  aiStatus: "manual-ready",
  // Priya has review history, so removing her deactivates the account; the
  // others have none and are deleted.
  users: [
    { id: "demo-admin", name: "Jordan Lee", role: "administrator" },
    { id: "demo-reviewer", name: "Priya Shah", role: "reviewer" },
    { id: "demo-approver", name: "Marcus Reed", role: "approver" },
    { id: "demo-submitter", name: "Alex Morgan", role: "submitter" },
  ],
  agreements: [
    {
      id: "agr-1042",
      vendor: "Northstar Cloud Systems",
      agreementType: "Software Subscription",
      businessUnit: "Corporate IT",
      neededBy: "2026-09-08",
      filename: "Northstar-MSA.pdf",
      status: "in_review",
      playbookVersion: "Software Subscription v2",
      createdAt: daysAgo(3),
    },
    {
      id: "agr-1041",
      vendor: "Apex Field Services",
      agreementType: "Professional Services",
      businessUnit: "Operations",
      neededBy: "2026-09-05",
      filename: "Apex-PSA.pdf",
      status: "escalated",
      playbookVersion: "Professional Services v1",
      createdAt: daysAgo(5),
    },
    {
      id: "agr-1039",
      vendor: "Meridian Analytics",
      agreementType: "Data Processing Addendum",
      businessUnit: "Finance",
      neededBy: "2026-09-15",
      filename: "Meridian-DPA.pdf",
      status: "ready_for_review",
      playbookVersion: "Data Processing Addendum v1",
      createdAt: daysAgo(1),
    },
    {
      id: "agr-1037",
      vendor: "Blue Ridge Logistics",
      agreementType: "Professional Services",
      businessUnit: "Distribution",
      neededBy: "2026-08-30",
      filename: "BlueRidge-Services.pdf",
      status: "cleared_with_conditions",
      playbookVersion: "Professional Services v1",
      createdAt: daysAgo(9),
    },
    // Earlier Northstar agreements, so the review queue can show vendor history.
    {
      id: "agr-1031",
      vendor: "Northstar Cloud Systems, Inc.",
      agreementType: "Software Subscription",
      businessUnit: "Corporate IT",
      neededBy: "2026-06-12",
      filename: "Northstar-Order-Form-2026.pdf",
      status: "cleared",
      playbookVersion: "Software Subscription v1",
      createdAt: daysAgo(120),
    },
    {
      id: "agr-1018",
      vendor: "Northstar Cloud Systems",
      agreementType: "Software Subscription",
      businessUnit: "Corporate IT",
      neededBy: "2025-11-03",
      filename: "Northstar-MSA-2025.pdf",
      status: "cleared_with_conditions",
      playbookVersion: "Software Subscription v1",
      createdAt: daysAgo(330),
    },
  ],
  findings: [
    {
      id: "f-1",
      agreementId: "agr-1042",
      provision: "Notice to Terminate Renewal",
      findingType: "present",
      severity: "medium",
      confidence: 94,
      sourceText:
        "This Agreement automatically renews for successive twelve-month periods unless Customer provides written notice at least ninety (90) days before expiration.",
      reason: "Provision language identified for human verification.",
      status: "open",
    },
    {
      id: "f-2",
      agreementId: "agr-1042",
      provision: "Cap on Liability",
      findingType: "present",
      severity: "medium",
      confidence: 91,
      sourceText:
        "Vendor's aggregate liability shall not exceed fees paid during the six months preceding the event giving rise to the claim.",
      reason: "Provision language identified for human verification.",
      status: "open",
    },
    {
      id: "f-3",
      agreementId: "agr-1042",
      provision: "Governing Law",
      findingType: "present",
      severity: "medium",
      confidence: 98,
      sourceText:
        "This Agreement is governed by the laws of the State of Georgia.",
      reason: "Provision language identified and confirmed by a reviewer.",
      status: "accepted",
      decisionReason: "Supporting text confirms that the provision is present.",
      decidedAt: daysAgo(2.6),
    },
    {
      id: "f-4",
      agreementId: "agr-1041",
      provision: "Insurance",
      findingType: "present",
      severity: "medium",
      confidence: 87,
      sourceText:
        "Consultant shall maintain commercial general liability and professional liability insurance throughout the term.",
      reason: "Provision language identified for human verification.",
      status: "escalated",
      decisionReason: "Approver will verify the category and supporting text.",
      decidedAt: daysAgo(4.2),
    },
    {
      id: "f-5",
      agreementId: "agr-1039",
      provision: "Audit Rights",
      findingType: "present",
      severity: "medium",
      confidence: 79,
      sourceText:
        "Customer may review Supplier's SOC 2 report and conduct a reasonable audit of records relevant to data security compliance.",
      reason: "Provision language identified for human verification.",
      status: "open",
    },
    {
      id: "f-6",
      agreementId: "agr-1031",
      provision: "Notice to Terminate Renewal",
      findingType: "present",
      severity: "medium",
      confidence: 93,
      sourceText:
        "The subscription renews for successive one-year terms unless either party gives sixty (60) days' written notice of non-renewal.",
      reason: "Provision language identified for human verification.",
      status: "accepted",
      decisionReason: "Renewal notice period confirmed; added to the contract calendar.",
      decidedAt: daysAgo(117),
    },
    {
      id: "f-7",
      agreementId: "agr-1031",
      provision: "Cap on Liability",
      findingType: "present",
      severity: "medium",
      confidence: 89,
      sourceText:
        "Each party's total liability is limited to the fees paid in the twelve months before the claim.",
      reason: "Provision language identified for human verification.",
      status: "accepted",
      decisionReason: "Twelve-month fee cap approved by Legal as standard for this vendor.",
      decidedAt: daysAgo(116.5),
    },
    {
      id: "f-8",
      agreementId: "agr-1018",
      provision: "Notice to Terminate Renewal",
      findingType: "present",
      severity: "medium",
      confidence: 90,
      sourceText:
        "This Agreement renews automatically unless Customer cancels at least ninety (90) days before the renewal date.",
      reason: "Provision language identified for human verification.",
      status: "accepted",
      decisionReason: "Notice period confirmed against the signed MSA.",
      decidedAt: daysAgo(328),
    },
    {
      id: "f-9",
      agreementId: "agr-1018",
      provision: "Cap on Liability",
      findingType: "present",
      severity: "medium",
      confidence: 84,
      sourceText:
        "Vendor's liability shall not exceed the fees paid in the six (6) months preceding the claim.",
      reason: "Provision language identified for human verification.",
      status: "escalated",
      decisionReason: "Six-month cap is below our standard; Approver to confirm with Legal.",
      decidedAt: daysAgo(327),
    },
    {
      id: "f-10",
      agreementId: "agr-1018",
      provision: "Governing Law",
      findingType: "present",
      severity: "medium",
      confidence: 96,
      sourceText: "This Agreement is governed by the laws of the State of Delaware.",
      reason: "Provision language identified for human verification.",
      status: "dismissed",
      decisionReason: "Clause refers to a superseded order form, not this agreement.",
      decidedAt: daysAgo(326.5),
    },
  ],
  rules: [
    ["Software Subscription", "Cap on Liability", "R", "Cap required; compare basis, amount, and carve-outs", "High"],
    ["Software Subscription", "Renewal Term", "M", "Monitor renewal term; absence is acceptable", "Medium"],
    ["Software Subscription", "Notice to Terminate Renewal", "C", "If auto-renewal exists, notice should be 60 days or less", "High"],
    ["Software Subscription", "Governing Law", "R", "Approved US jurisdiction required", "Medium"],
    ["Software Subscription", "Exclusivity", "M", "Any exclusivity requires review", "High"],
    ["Professional Services", "Cap on Liability", "R", "Cap required and must match approved PSA allocation", "High"],
    ["Professional Services", "Termination for Convenience", "R", "Customer convenience termination expected", "High"],
    ["Professional Services", "Insurance", "R", "CGL and professional coverage required", "High"],
    ["Professional Services", "Warranty Duration", "R", "Services warranty and remedy required", "Medium"],
    ["Data Processing Addendum", "Cap on Liability", "R", "Data exposure must match approved DPA standard", "High"],
    ["Data Processing Addendum", "Audit Rights", "R", "Acceptable audit or assurance mechanism required", "High"],
    ["Data Processing Addendum", "Insurance", "C", "Cyber coverage required for elevated risk tier", "High"],
    ["Data Processing Addendum", "Change of Control", "C", "Processing obligations must survive transfer or control change", "High"],
    ["Data Processing Addendum", "Governing Law", "R", "DPA or incorporated agreement must provide governing law", "Medium"],
    ["Professional Services", "Governing Law", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Licensing", "Cap on Liability", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Licensing", "Renewal Term", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Licensing", "Notice to Terminate Renewal", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Licensing", "Governing Law", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Licensing", "Exclusivity", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Licensing", "Change of Control", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Logistics and Freight", "Cap on Liability", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Logistics and Freight", "Termination for Convenience", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Logistics and Freight", "Insurance", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Logistics and Freight", "Governing Law", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Mutual NDA", "Governing Law", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Mutual NDA", "Change of Control", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Other", "Cap on Liability", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Other", "Termination for Convenience", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Other", "Insurance", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Other", "Change of Control", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Other", "Governing Law", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Other", "Renewal Term", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Other", "Notice to Terminate Renewal", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Other", "Exclusivity", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Other", "Audit Rights", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
    ["Other", "Warranty Duration", "M", "Disabled stretch metadata - not used by the baseline", "Medium"],
  ].map((r, i) => ({
    id: `rule-${i + 1}`,
    agreementType: r[0],
    provision: r[1],
    applicability: r[2],
    standard: r[3],
    severity: r[4],
    active: true,
  })),
  comments: [
    {
      id: "c-1",
      findingId: "f-2",
      agreementId: "agr-1042",
      authorName: "Priya Shah",
      authorRole: "submitter",
      body: "Legal approved a twelve-month cap with Northstar last spring. This draft says six months. Can we push back before accepting?",
      createdAt: daysAgo(2),
    },
    {
      id: "c-2",
      findingId: "f-2",
      agreementId: "agr-1042",
      authorName: "Jordan Lee",
      authorRole: "administrator",
      body: "Agreed. The six-month cap was escalated on the 2025 MSA too. I'll hold this finding until procurement hears back from the vendor.",
      createdAt: daysAgo(1),
    },
  ],
  playbookVersions: [],
  audit: [
    {
      id: uid(),
      agreementId: "agr-1042",
      actorName: "Jordan Lee",
      eventType: "Agreement submitted",
      detail: "Software Subscription agreement submitted for Corporate IT.",
      createdAt: now(),
    },
    {
      id: uid(),
      agreementId: "agr-1042",
      actorName: "Analysis service",
      eventType: "Analysis completed",
      detail: "3 provision-presence findings created using Software Subscription v1.",
      createdAt: now(),
    },
  ],
};
// Every contract type lists all ten provisions. Those not in the original
// playbook are added switched off, numbered in the same order as
// supabase/schema.sql (rule-38 onward), so an Administrator can turn them on.
for (const agreementType of agreementTypes)
  for (const entry of taxonomy)
    if (!seed.rules.some((rule) => rule.agreementType === agreementType && rule.provision === entry.calderProvision))
      seed.rules.push({
        id: `rule-${seed.rules.length + 1}`,
        agreementType,
        provision: entry.calderProvision,
        applicability: "M",
        standard: "Disabled stretch metadata - not used by the baseline",
        severity: "Medium",
        active: false,
      });
// Version 1 of every playbook, plus a v2 for Software Subscription when
// Exclusivity was switched on, so the older Northstar reviews show as
// reviewed under an earlier playbook.
const activeFor = (agreementType: string, skip?: string) =>
  seed.rules
    .filter((rule) => rule.agreementType === agreementType && rule.active && rule.provision !== skip)
    .map((rule) => rule.provision)
    .sort();
seed.playbookVersions = [...new Set(seed.rules.map((rule) => rule.agreementType))].map((agreementType) => ({
  agreementType,
  version: 1,
  activeProvisions: activeFor(agreementType, agreementType === "Software Subscription" ? "Exclusivity" : undefined),
  summary: "Initial playbook",
  changedBy: "System",
  createdAt: daysAgo(400),
}));
seed.playbookVersions.push({
  agreementType: "Software Subscription",
  version: 2,
  activeProvisions: activeFor("Software Subscription"),
  summary: "Exclusivity switched on",
  changedBy: "Jordan Lee",
  createdAt: daysAgo(30),
});
const cloneSeed = () => JSON.parse(JSON.stringify(seed)) as Data;
export function localRead() {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) {
    const value = cloneSeed();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
    return value;
  }
  return JSON.parse(raw) as Data;
}
export function localWrite(value: Data) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
}
export function resetLocalDemo() {
  localStorage.removeItem(LOCAL_KEY);
  location.reload();
}

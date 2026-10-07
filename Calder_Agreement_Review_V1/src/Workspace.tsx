"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileSearch,
  FileText,
  Gavel,
  HelpCircle,
  LayoutDashboard,
  Loader2,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Upload,
  UserRoundCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Toaster, toast } from "sonner";
import {
  analyzeExtractedText,
  extractDocumentText,
  loadAgreementFile,
  loadAgreementText,
  rememberAgreementFile,
  rememberAgreementText,
  sourceTextInDocument,
  type AnalysisFinding,
  type AnalysisMode,
} from "@/lib/analyze";
import {
  entriesForAgreementType,
  taxonomy,
  taxonomyDescription,
} from "@/lib/candidateRetrieval";
import {
  agreementTypes,
  roleLabels,
  type AnalysisPath,
  type UserRole,
} from "@/lib/data";
import {
  downloadFile,
  isPdfFile,
  renderPdfPages,
  renderPdfThumbnail,
} from "@/lib/documentPreview";
type Agreement = {
  id: string;
  vendor: string;
  agreementType: string;
  businessUnit: string;
  neededBy: string;
  filename: string;
  storageKey?: string | null;
  analysisPath?: AnalysisPath | null;
  status: string;
  playbookVersion: string;
  createdAt: string;
};
type Finding = {
  id: string;
  agreementId: string;
  provision: string;
  findingType: string;
  severity: string;
  confidence: number;
  sourceText: string;
  reason: string;
  status: string;
  decisionReason?: string;
  analysisMethod?: string;
};
type Rule = {
  id: string;
  agreementType: string;
  provision: string;
  applicability: string;
  standard: string;
  method: string;
  severity: string;
  active: boolean;
};
type Audit = {
  id: string;
  agreementId?: string;
  actorName: string;
  eventType: string;
  detail: string;
  createdAt: string;
};
type Data = {
  me: { name: string; email: string; role: UserRole };
  agreements: Agreement[];
  findings: Finding[];
  rules: Rule[];
  audit: Audit[];
  aiStatus: string;
  users?: { id: string; name: string; role: UserRole }[];
};
type NavIcon = typeof LayoutDashboard;
type NavItem = readonly [string, string, NavIcon];
type NavSection = { label: string | null; items: NavItem[] };
const navSections: NavSection[] = [
  {
    label: null,
    items: [["overview", "Overview", LayoutDashboard]],
  },
  {
    label: "Work",
    items: [
      ["intake", "New intake", Upload],
      ["queue", "Review queue", FileSearch],
      ["agreements", "Agreements", Archive],
    ],
  },
  {
    label: "Insights",
    items: [
      ["reports", "Reporting", BarChart3],
      ["audit", "Audit log", ShieldCheck],
    ],
  },
  {
    label: "Admin",
    items: [
      ["playbook", "Playbooks", BookOpenCheck],
      ["profile", "Profile & access", UserRoundCog],
    ],
  },
];
const nav = navSections.flatMap((section) => section.items);
const label = (s?: string | null) =>
  s?.trim()
    ? s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Not available";
const tone = (s?: string | null) =>
  s === "high" || s === "escalated"
    ? "red-tone"
    : s === "medium" || s === "in_review"
      ? "amber-tone"
      : s?.startsWith("cleared") || ["accepted", "approved", "review_complete"].includes(s || "")
        ? "green-tone"
        : "slate-tone";
// Needed-by dates are stored as YYYY-MM-DD. Parse them as local calendar
// dates; `new Date("2026-09-08")` is UTC midnight and shows as Sep 7 in
// US time zones.
const parseDueDate = (value?: string | null) => {
  const day = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = day
    ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
    : new Date(value ?? "");
  return Number.isNaN(date.getTime()) ? null : date;
};
const daysUntilDue = (value?: string | null) => {
  const due = parseDueDate(value);
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
};
const formatDueDate = (
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
) => parseDueDate(value)?.toLocaleDateString(undefined, options) ?? "No date";
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
const agreementStatusFromFindings = (
  agreement: Agreement,
  findings: Finding[],
) => {
  if (agreement.status.startsWith("cleared")) return agreement.status;
  const statuses = findings
    .filter((finding) => finding.agreementId === agreement.id)
    .map((finding) => finding.status);
  // No automated findings (manual mode, failed analysis, or nothing matched)
  // means someone has to identify provisions by hand.
  if (!statuses.length && agreement.status === "ready_for_review")
    return "manual_review_required";
  if (statuses.includes("escalated")) return "escalated";
  if (statuses.length && statuses.every((status) => status === "accepted"))
    return "approved";
  if (
    statuses.length &&
    statuses.every((status) => ["accepted", "dismissed"].includes(status))
  )
    return "review_complete";
  if (statuses.some((status) => ["accepted", "dismissed"].includes(status)))
    return "in_review";
  return agreement.status;
};
const allowedViews: Record<UserRole, string[]> = {
  submitter: ["overview", "intake", "agreements", "profile"],
  reviewer: ["overview", "intake", "queue", "agreements", "reports", "audit", "profile"],
  approver: ["overview", "intake", "queue", "agreements", "reports", "audit", "profile"],
  administrator: nav.map(([id]) => id),
};
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
const WORKSPACE_LOAD_TIMEOUT_MS = 15000;
export default function Workspace() {
  const [data, setData] = useState<Data | null>(null),
    [view, setView] = useState("overview"),
    [selected, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [type, setType] = useState("All"),
    [status, setStatus] = useState("All"),
    [busy, setBusy] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 780);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const runSearch = () => {
    if (search.trim() && view !== "agreements") setView("agreements");
    searchInputRef.current?.focus();
  };
  const refresh = async () => {
    const r = await fetch("/api/workspace"),
      j = await r.json();
    if (!r.ok) throw new Error(j.error);
    setData(j);
  };
  // The Toaster is not mounted until data loads, so initial-load failures are
  // shown on the loading screen with a Retry button instead of as a toast.
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadWorkspace = async (attempts = 1) => {
    setLoadError(null);
    for (let attempt = 1; ; attempt++) {
      try {
        await Promise.race([
          refresh(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("The workspace took too long to load.")),
              WORKSPACE_LOAD_TIMEOUT_MS,
            ),
          ),
        ]);
        return;
      } catch (e) {
        if (attempt >= attempts) {
          setLoadError(e instanceof Error ? e.message : "Could not load the workspace.");
          return;
        }
      }
    }
  };
  useEffect(() => {
    void loadWorkspace(2);
  }, []);
  useEffect(() => {
    if (data && !allowedViews[data.me.role].includes(view)) setView("overview");
  }, [data, view]);
  const findings = useMemo(() => data?.findings ?? [], [data?.findings]);
  const agreements = useMemo(
    () =>
      (data?.agreements ?? []).map((agreement) => ({
        ...agreement,
        status: agreementStatusFromFindings(agreement, findings),
      })),
    [data?.agreements, findings],
  );
  const statuses = useMemo(
    () => [...new Set(agreements.map((a) => a.status).filter(Boolean))].sort(),
    [agreements],
  );
  const filtered = useMemo(
    () =>
      agreements.filter(
        (a) =>
          (type === "All" || a.agreementType === type) &&
          (status === "All" || a.status === status) &&
          `${a.vendor} ${a.id} ${a.businessUnit}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [agreements, type, status, search],
  );
  const agreement = agreements.find((a) => a.id === selected) ?? agreements[0];
  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch("/api/workspace", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await refresh();
      toast.success("Saved and added to the audit record.");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return loadError ? (
      <div className="loading" role="alert">
        <p className="loading-error-title">We couldn't load your Calder workspace.</p>
        <p className="loading-error-detail">{loadError}</p>
        <Button className="loading-retry" onClick={() => void loadWorkspace()}>
          Retry
        </Button>
      </div>
    ) : (
      <div className="loading">
        <div className="loader" />
        <p>Preparing Calder workspace…</p>
      </div>
    );
  const workspaceData = { ...data, agreements };
  const canSubmit = true;
  const canReview = ["reviewer", "approver", "administrator"].includes(data.me.role);
  const visibleNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(([id]) =>
        allowedViews[data.me.role].includes(id),
      ),
    }))
    .filter((section) => section.items.length > 0);
  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <Toaster richColors position="top-right" />
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
        <div className="brand">
          <div className="brand-mark">
            <Gavel size={19} />
          </div>
          <div>
            <strong>Calder</strong>
            <span>Agreement Review</span>
          </div>
        </div>
        <button
          className="sidebar-collapse"
          aria-label={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
          title={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
          onClick={() => setSidebarOpen((open) => !open)}
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
        <nav>
          {visibleNavSections.map((section) => (
            <Fragment key={section.label ?? "primary"}>
              {section.label && (
                <span className="nav-section-label">{section.label}</span>
              )}
              {section.items.map(([id, n, Icon]) => (
                <button
                  key={id}
                  className={view === id ? "active" : ""}
                  aria-label={n}
                  title={n}
                  onClick={() => {
                    setView(id);
                    if (window.innerWidth <= 780) setSidebarOpen(false);
                  }}
                >
                  <Icon size={18} />
                  <span>{n}</span>
                  {id === "queue" && (
                    <em>{findings.filter((f) => f.status === "open").length}</em>
                  )}
                </button>
              ))}
            </Fragment>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="ai-ok">
            <span /> Manual review ready
          </div>
          <div className="profile">
            <div className="avatar">
              {data.me.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong>{data.me.name}</strong>
              <span>{roleLabels[data.me.role]}</span>
            </div>
          </div>
          <a href="/signout-with-chatgpt?return_to=/">Sign out</a>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button
            className="menu"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeftOpen size={19} />
          </button>
          <div>
            <h1>{nav.find((n) => n[0] === view)?.[1]}</h1>
            <p>
              {view === "overview"
                ? "Operational control for inbound vendor agreements"
                : "Calder Industrial Supply"}
            </p>
          </div>
          <div className="top-actions">
            <div className="global-search">
              <button type="button" aria-label="Search" onClick={runSearch}>
                <Search size={17} />
              </button>
              <input
                ref={searchInputRef}
                aria-label="Search agreements"
                placeholder="Search vendor, ID, unit…"
                value={search}
                onChange={(e) => {
                  const next = e.target.value;
                  setSearch(next);
                  if (next.trim() && view !== "agreements") setView("agreements");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                }}
              />
            </div>
            {canSubmit && <Button onClick={() => setView("intake")}> 
              <Plus size={16} /> New agreement
            </Button>}
          </div>
        </header>
        <div className="content">
          {view === "overview" && (
            <Overview
              data={workspaceData}
              onQueue={() => setView(canReview ? "queue" : "agreements")}
              onNavigate={(next) =>
                setView(
                  allowedViews[data.me.role].includes(next) ? next : "overview",
                )
              }
              onSelect={(id) => {
                setSelected(id);
                setView(canReview ? "queue" : "agreements");
              }}
            />
          )}
          {view === "intake" && canSubmit && (
            <Intake busy={busy} submit={post} rules={data.rules} />
          )}{" "}
          {view === "queue" && canReview && (
            <Queue
              data={workspaceData}
              selected={agreement}
              setSelected={setSelected}
              decide={post}
              busy={busy}
              role={data.me.role}
            />
          )}{" "}
          {view === "agreements" && (
            <Agreements
              rows={filtered}
              search={search}
              setSearch={setSearch}
              type={type}
              setType={setType}
              status={status}
              setStatus={setStatus}
              statuses={statuses}
              onSelect={canReview ? (id) => {
                setSelected(id);
                setView("queue");
              } : undefined}
            />
          )}
          {view === "playbook" && data.me.role === "administrator" && <Playbook rules={data.rules} update={post} />}{" "}
          {view === "reports" && <Reports data={workspaceData} />} {" "}
          {view === "audit" && <AuditLog events={data.audit} />}
          {view === "profile" && <ProfileAccess me={data.me} users={data.users || []} update={post} />}
        </div>
      </main>
    </div>
  );
}
function Kpi({
  label: l,
  value,
  note,
  icon: Icon,
  danger,
}: {
  label: string;
  value: number;
  note: string;
  icon: any;
  danger?: boolean;
}) {
  return (
    <Card className="kpi">
      <CardContent>
        <div className={danger ? "kpi-icon danger" : "kpi-icon"}>
          <Icon size={19} />
        </div>
        <span>{l}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </CardContent>
    </Card>
  );
}
function DueChip({ neededBy }: { neededBy: string }) {
  const days = daysUntilDue(neededBy);
  if (days === null || days > 3) return null;
  const text =
    days < 0
      ? `Overdue ${-days} ${-days === 1 ? "day" : "days"}`
      : days === 0
        ? "Due today"
        : `Due in ${days} ${days === 1 ? "day" : "days"}`;
  return (
    <em className={`due-chip ${days < 0 ? "red-tone" : "amber-tone"}`}>
      {text}
    </em>
  );
}
function Overview({
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
function Intake({
  submit,
  busy,
  rules,
}: {
  submit: (b: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  rules: Rule[];
}) {
  const [form, setForm] = useState({
      vendor: "",
      agreementType: "Software Subscription",
      businessUnit: "Corporate IT",
      neededBy: "",
      filename: "",
      storageKey: "",
    }),
    [file, setFile] = useState<File | null>(null),
    [analysisMode, setAnalysisMode] = useState<AnalysisMode>("automatic"),
    [analysisStatus, setAnalysisStatus] = useState(""),
    [submitting, setSubmitting] = useState(false);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await runSubmission();
    } finally {
      setSubmitting(false);
    }
  };
  const runSubmission = async () => {
    if (!file) {
      toast.error("Choose a searchable PDF or TXT file before submitting.");
      return;
    }
    setAnalysisStatus("Preparing document…");
    let next = { ...form };
    let extractedText = "";
    const uploadSelectedFile = async () => {
      const fd = new FormData();
      fd.append("file", file);
      const response = await fetch("/api/workspace", {
        method: "PUT",
        body: fd,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.error === "string" ? result.error : "Upload failed.",
        );
      return result as { filename: string; key: string };
    };
    try {
      setAnalysisStatus("Validating searchable document text…");
      extractedText = await extractDocumentText(file);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The document could not be read.";
      setAnalysisStatus(`${message} Submission was not stored.`);
      toast.error(`${message} Submission was not stored.`);
      return;
    }
    let uploadResult: { filename: string; key: string };
    try {
      uploadResult = await uploadSelectedFile();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setAnalysisStatus(`${message} Submission was not stored.`);
      toast.error(`${message} Submission was not stored.`);
      return;
    }
    next = {
      ...next,
      filename: uploadResult.filename,
      storageKey: uploadResult.key,
    };
    rememberAgreementText(uploadResult.key, extractedText);
    rememberAgreementFile(uploadResult.key, file);
    const agreementId = `agr-${crypto.randomUUID().slice(0, 8)}`;
    if (
      await submit({
        action: "create_agreement",
        id: agreementId,
        status:
          analysisMode === "manual" ? "manual_review_required" : "ready_for_review",
        ...next,
        // Recorded so the review queue knows how to present the document.
        analysisPath: analysisMode,
      })
    ) {
      const analysisStarted = performance.now();
      let result: {
        method: "manual" | "ai" | "deterministic";
        findings: AnalysisFinding[];
        notice: string;
      };
      try {
        setAnalysisStatus(
          analysisMode === "automatic"
            ? "Agreement stored. Trying hosted extraction, with deterministic fallback…"
            : analysisMode === "deterministic"
              ? "Agreement stored. Running deterministic analysis…"
              : "Agreement stored. Opening the manual review path…",
        );
        result = await analyzeExtractedText(
          extractedText,
          form.agreementType,
          analysisMode,
          rules.filter((rule) => rule.agreementType === form.agreementType),
        );
      } catch {
        result = {
          method: "manual",
          findings: [],
          notice:
            "Agreement stored. Automated analysis failed, so guided manual review remains available.",
        };
      }
      const analysisDurationMs = Math.round(performance.now() - analysisStarted);
      await submit({
        action: "add_analysis_findings",
        agreementId,
        analysisMethod: result.method,
        analysisDurationMs,
        findings: result.findings,
      });
      setAnalysisStatus(result.notice);
      toast.success(result.notice);
      setForm({
        vendor: "",
        agreementType: "Software Subscription",
        businessUnit: "Corporate IT",
        neededBy: "",
        filename: "",
        storageKey: "",
      });
      setFile(null);
    }
  };
  return (
    <div className="form-layout">
      <section>
        <div className="section-title">
          <h2>Submit a vendor agreement</h2>
          <p>
            Provide the minimum information needed to route and review this
            agreement.
          </p>
        </div>
        <form className="intake-form" onSubmit={send}>
          <div>
            <Label>Vendor</Label>
            <Input
              required
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              placeholder="Vendor legal name"
            />
          </div>
          <div className="form-grid">
            <div>
              <Label>Agreement type</Label>
              <Select
                value={form.agreementType}
                onValueChange={(v) => setForm({ ...form, agreementType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agreementTypes.map((agreementType) => (
                    <SelectItem key={agreementType} value={agreementType}>
                      {agreementType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Business unit</Label>
              <Select
                value={form.businessUnit}
                onValueChange={(v) => setForm({ ...form, businessUnit: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Corporate IT">Corporate IT</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Distribution">Distribution</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Needed-by date</Label>
            <Input
              required
              type="date"
              value={form.neededBy}
              onChange={(e) => setForm({ ...form, neededBy: e.target.value })}
            />
          </div>
          <div>
            <Label>Analysis path</Label>
            <Select
              value={analysisMode}
              onValueChange={(value) => setAnalysisMode(value as AnalysisMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">
                  Automatic: AI → deterministic fallback
                </SelectItem>
                <SelectItem value="deterministic">
                  Deterministic only
                </SelectItem>
                <SelectItem value="manual">Manual review only</SelectItem>
              </SelectContent>
            </Select>
            <span className="field-help">
              AI is optional. If it is disabled or unavailable, deterministic
              analysis runs automatically.
            </span>
          </div>
          <div>
            <Label>Agreement PDF or text file</Label>
            <label className="drop">
              <Upload size={24} />
              <strong>{file ? file.name : "Choose a PDF or TXT file"}</strong>
              <span>
                Maximum 10 MB. Image-only PDFs are rejected before submission;
                OCR is outside this release.
              </span>
              <input
                type="file"
                accept="application/pdf,text/plain,.pdf,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="form-actions">
            <Button
              type="submit"
              disabled={busy || submitting}
              aria-busy={busy || submitting}
            >
              {busy || submitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Submitting…
                </>
              ) : (
                "Submit for review"
              )}
            </Button>
            <span>Submission creates an attributable audit record.</span>
          </div>
          {analysisStatus && (
            <div
              className="analysis-status flex items-center gap-2"
              role="status"
            >
              {submitting && (
                <Loader2
                  size={14}
                  className="shrink-0 animate-spin"
                  aria-hidden="true"
                />
              )}
              {analysisStatus}
            </div>
          )}
        </form>
      </section>
      <aside className="process-panel">
        <h3>What happens next</h3>
        {[
          [
            "1",
            "Private intake",
            "The PDF and metadata are stored as an agreement version.",
          ],
          [
            "2",
            "Presence identification",
            "Active playbook categories return source text and confidence.",
          ],
          [
            "3",
            "Human review",
            "A reviewer accepts, dismisses, or escalates each flag.",
          ],
          [
            "4",
            "Disposition",
            "The agreement is cleared, conditioned, or escalated.",
          ],
        ].map((x) => (
          <div key={x[0]}>
            <b>{x[0]}</b>
            <p>
              <strong>{x[1]}</strong>
              <span>{x[2]}</span>
            </p>
          </div>
        ))}
        <div className="manual-note">
          <FileSearch size={18} />
          <p>
            <strong>Automation is optional</strong>
            <span>
              If analysis is unavailable, the agreement enters manual review
              without losing the workflow.
            </span>
          </p>
        </div>
      </aside>
    </div>
  );
}

function Queue({
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
/**
 * The submitted agreement, shown inside the review queue.
 * - Manual analysis path: the reviewer is identifying provisions by hand, so
 *   the whole document is shown in a scrollable panel.
 * - Automatic / deterministic paths: findings already carry their source
 *   text, so a small first-page preview is enough; clicking it downloads
 *   the original file.
 */
function AgreementDocument({ agreement }: { agreement: Agreement }) {
  const fullView = agreement.analysisPath === "manual";
  const [file, setFile] = useState<Blob | null>(null),
    [state, setState] = useState<"loading" | "ready" | "missing" | "error">(
      "loading",
    ),
    [thumbnail, setThumbnail] = useState(""),
    [plainText, setPlainText] = useState("");
  const pagesRef = useRef<HTMLDivElement>(null);
  const isPdf = file ? isPdfFile(agreement.filename, file) : false;

  // 1. Find the original file (browser storage in demo, Supabase when hosted).
  useEffect(() => {
    let cancelled = false;
    loadAgreementFile(agreement.storageKey).then((found) => {
      if (cancelled) return;
      setFile(found);
      setState(found ? "ready" : "missing");
    });
    return () => {
      cancelled = true;
    };
  }, [agreement.storageKey]);

  // 2. Prepare what to show: thumbnail, every PDF page, or plain text.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const fail = () => !cancelled && setState("error");
    if (!isPdf) {
      file.text().then((text) => !cancelled && setPlainText(text), fail);
    } else if (!fullView) {
      renderPdfThumbnail(file).then(
        (image) => !cancelled && setThumbnail(image),
        fail,
      );
    } else if (pagesRef.current) {
      const container = pagesRef.current;
      container.replaceChildren();
      const width = Math.min(container.clientWidth || 720, 900);
      renderPdfPages(file, container, width, () => cancelled).catch(fail);
    }
    return () => {
      cancelled = true;
    };
  }, [file, isPdf, fullView]);

  const download = () => file && downloadFile(file, agreement.filename);

  if (state === "loading")
    return (
      <div className="agreement-document is-note" role="status">
        <Loader2 size={16} className="spin" /> Loading the submitted agreement…
      </div>
    );
  if (state === "missing")
    return (
      <div className="agreement-document is-note">
        <FileText size={16} />
        <span>
          The original file for {agreement.filename} isn't available here.
          Seeded demo agreements have no file, and demo-mode uploads stay in
          the browser they were submitted from.
        </span>
      </div>
    );

  if (!fullView)
    return (
      <div className="agreement-document is-preview">
        <button
          type="button"
          className="document-thumb"
          onClick={download}
          aria-label={`Download ${agreement.filename}`}
          title="Click to download"
        >
          {isPdf && thumbnail ? (
            <img src={thumbnail} alt={`First page of ${agreement.filename}`} />
          ) : isPdf ? (
            <FileText size={28} />
          ) : (
            <span className="thumb-text">{plainText.slice(0, 400)}</span>
          )}
          <span className="thumb-overlay">
            <Download size={16} />
          </span>
        </button>
        <div>
          <strong>Submitted agreement</strong>
          <span>{agreement.filename}</span>
          <small>Click the preview to download the original file.</small>
        </div>
      </div>
    );

  return (
    <section className="agreement-document is-full" aria-label="Submitted agreement">
      <header>
        <div>
          <strong>Submitted agreement</strong>
          <span>
            {agreement.filename} · manual review path, so the full document is
            shown
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={download}>
          <Download size={15} /> Download
        </Button>
      </header>
      {state === "error" ? (
        <p className="document-error">
          This document couldn't be displayed in the browser. Use Download to
          open it instead.
        </p>
      ) : isPdf ? (
        <div className="document-pages" ref={pagesRef} tabIndex={0} />
      ) : (
        <pre className="document-pages document-text" tabIndex={0}>
          {plainText}
        </pre>
      )}
    </section>
  );
}

function ManualFinding({
  agreement,
  submit,
}: {
  agreement: Agreement;
  submit: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const categories = entriesForAgreementType(agreement.agreementType);
  const provisions = (categories.length ? categories : taxonomy).map(
    (entry) => entry.calderProvision,
  );
  const blank = {
    provision: provisions[0] ?? "",
    confidence: "100",
    sourceText: "",
    reason: "",
  };
  const [open, setOpen] = useState(false),
    [f, setF] = useState(blank),
    [checking, setChecking] = useState(false),
    [problem, setProblem] = useState("");
  const confidence = Number(f.confidence);
  const confidenceValid =
    f.confidence.trim() !== "" &&
    Number.isFinite(confidence) &&
    confidence >= 0 &&
    confidence <= 100;
  const ready =
    provisions.includes(f.provision) &&
    f.sourceText.trim() !== "" &&
    confidenceValid;
  const add = async () => {
    setChecking(true);
    setProblem("");
    try {
      const text = await loadAgreementText(agreement.storageKey);
      if (text && !sourceTextInDocument(f.sourceText, text)) {
        setProblem(
          "This text was not found in the agreement. Paste it exactly as it appears in the document.",
        );
        return;
      }
      if (
        await submit({
          action: "add_manual_finding",
          agreementId: agreement.id,
          provision: f.provision,
          confidence,
          sourceText: f.sourceText.trim(),
          reason: f.reason,
          sourceVerified: Boolean(text),
        })
      ) {
        setOpen(false);
        setF(blank);
        if (!text)
          toast.warning(
            "Finding added, but the agreement file was unavailable, so the source text could not be verified.",
          );
      }
    } finally {
      setChecking(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setProblem("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus size={16} /> Add manual finding
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add source-linked finding</DialogTitle>
          <DialogDescription>
            Use this path when automation is unavailable or needs correction.
            The source text is checked against the stored agreement.
          </DialogDescription>
        </DialogHeader>
        <div className="decision-form">
          <Label>Provision</Label>
          <Select
            value={f.provision}
            onValueChange={(provision) => setF({ ...f, provision })}
          >
            <SelectTrigger aria-label="Provision">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {provisions.map((provision) => (
                <SelectItem key={provision} value={provision}>
                  {provision}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label>Confidence (0-100)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={f.confidence}
            aria-invalid={!confidenceValid}
            onChange={(e) => setF({ ...f, confidence: e.target.value })}
          />
          {!confidenceValid && (
            <p className="field-error" role="alert">
              Enter a number from 0 to 100.
            </p>
          )}
          <Label>Exact source text</Label>
          <Textarea
            value={f.sourceText}
            aria-invalid={!!problem}
            onChange={(e) => {
              setF({ ...f, sourceText: e.target.value });
              setProblem("");
            }}
          />
          {problem && (
            <p className="field-error" role="alert">
              {problem}
            </p>
          )}
          <Label>Reviewer note (optional)</Label>
          <Textarea
            value={f.reason}
            onChange={(e) => setF({ ...f, reason: e.target.value })}
          />
          <Button disabled={!ready || checking} onClick={add}>
            {checking ? "Checking source text…" : "Add finding"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function Agreements({
  rows,
  search,
  setSearch,
  type,
  setType,
  status,
  setStatus,
  statuses,
  onSelect,
}: {
  rows: Agreement[];
  search: string;
  setSearch: (s: string) => void;
  type: string;
  setType: (s: string) => void;
  status: string;
  setStatus: (s: string) => void;
  statuses: string[];
  onSelect?: (s: string) => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardHeader className="table-tools">
        <div>
          <CardTitle>Agreement register</CardTitle>
          <p>All versions, workflow states, and due dates</p>
        </div>
        <div className="agreement-filters">
          <div className="global-search">
            <button
              type="button"
              aria-label="Search"
              onClick={() => searchInputRef.current?.focus()}
            >
              <Search size={16} />
            </button>
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="type-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All types</SelectItem>
              {agreementTypes.map((agreementType) => (
                <SelectItem key={agreementType} value={agreementType}>
                  {agreementType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="status-filter" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All statuses</SelectItem>
              {statuses.map((agreementStatus) => (
                <SelectItem key={agreementStatus} value={agreementStatus}>
                  {label(agreementStatus)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="registry">
        <div className="registry-head">
          <span>Agreement</span>
          <span>Type / unit</span>
          <span>Needed by</span>
          <span>Status</span>
          <span />
        </div>
        {rows.map((a) => (
          <button key={a.id} disabled={!onSelect} onClick={() => onSelect?.(a.id)}>
            <span>
              <FileText size={18} />
              <b>
                {a.vendor}
                <small>
                  {a.id} · {a.filename}
                </small>
              </b>
            </span>
            <span>
              {a.agreementType}
              <small>{a.businessUnit}</small>
            </span>
            <span>{formatDueDate(a.neededBy)}</span>
            <Badge variant="outline" className={tone(a.status)}>
              {label(a.status)}
            </Badge>
            <ChevronRight size={17} />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
function Playbook({
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
function Reports({ data }: { data: Data }) {
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
function ProfileAccess({
  me,
  users,
  update,
}: {
  me: Data["me"];
  users: NonNullable<Data["users"]>;
  update: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [name, setName] = useState(me.name);
  const permissions: Record<UserRole, string[]> = {
    submitter: ["Submit agreements", "Track your submissions", "View final outcomes"],
    reviewer: ["Work the review queue", "Add manual findings", "Accept, dismiss, or escalate"],
    approver: ["Reviewer capabilities", "Resolve escalated items", "Set final disposition"],
    administrator: ["Manage playbooks", "Assign access", "View reporting and audit history"],
  };
  return (
    <div className="profile-access-grid">
      <Card>
        <CardHeader>
          <CardTitle>Profile & access</CardTitle>
          <p>Your assigned role controls the work areas and actions available to you.</p>
        </CardHeader>
        <CardContent className="profile-form">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <span className="field-help">
            Your role is assigned by an Administrator. Profile settings cannot change permissions.
          </span>
          <Button onClick={() => update({ action: "update_profile", name })}>
            Save profile
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Current access</CardTitle></CardHeader>
        <CardContent className="access-summary">
          <Badge variant="outline" className="green-tone">{roleLabels[me.role]}</Badge>
          <h3>{me.name}</h3><p>{me.email}</p>
          <ul>{permissions[me.role].map((permission) => <li key={permission}><CheckCircle2 size={16}/>{permission}</li>)}</ul>
        </CardContent>
      </Card>
      {me.role === "administrator" && (
        <Card className="access-admin-card">
          <CardHeader><CardTitle>Access administration</CardTitle><p>Approve requests and assign each user’s operating role.</p></CardHeader>
          <CardContent className="access-user-list">
            {users.map((user) => <AccessUser key={user.id} user={user} update={update}/>) }
          </CardContent>
        </Card>
      )}
    </div>
  );
}
function AccessUser({ user, update }: { user: NonNullable<Data["users"]>[number]; update: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [role, setRole] = useState<UserRole>(user.role);
  return <div className="access-user-row"><div><strong>{user.name}</strong><span>Current: {roleLabels[user.role]}</span></div><Select value={role} onValueChange={(value)=>setRole(value as UserRole)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="submitter">Submitter</SelectItem><SelectItem value="reviewer">Reviewer</SelectItem><SelectItem value="approver">Approver</SelectItem><SelectItem value="administrator">Administrator</SelectItem></SelectContent></Select><Button variant="outline" disabled={role===user.role} onClick={()=>update({action:"assign_role",userId:user.id,role})}>Assign</Button></div>;
}
function AuditLog({ events }: { events: Audit[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attributable audit history</CardTitle>
        <p>
          Append-only activity across intake, analysis, review, playbook, and
          disposition.
        </p>
      </CardHeader>
      <CardContent className="timeline">
        {events.map((e) => (
          <div key={e.id}>
            <span className="timeline-dot" />
            <time>{new Date(e.createdAt).toLocaleString()}</time>
            <section>
              <strong>{e.eventType}</strong>
              <p>{e.detail}</p>
              <small>
                {e.actorName}
                {e.agreementId ? ` · ${e.agreementId}` : ""}
              </small>
            </section>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

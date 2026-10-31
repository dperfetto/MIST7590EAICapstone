"use client";
import { type Agreement, type Data, type Finding } from "@/workspace/types";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { allowedViews, nav, navSections } from "@/workspace/navigation";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Gavel, PanelLeftOpen, Plus, Search } from "lucide-react";
import { roleLabels } from "@/lib/model";
import { Overview } from "@/pages/Overview";
import { Intake } from "@/pages/intake/Intake";
import { Queue } from "@/pages/review-queue/Queue";
import { Agreements } from "@/pages/Agreements";
import { Playbook } from "@/pages/Playbook";
import { Reports } from "@/pages/Reports";
import { AuditLog } from "@/pages/AuditLog";
import { Evaluation } from "@/pages/evaluation/Evaluation";
import { ProfileAccess } from "@/pages/ProfileAccess";

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
  // quiet: skip the success toast, for callers that report progress themselves (bulk intake).
  const post = async (body: Record<string, unknown>, options?: { quiet?: boolean }) => {
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
      if (!options?.quiet) toast.success("Saved and added to the audit record.");
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
  // Submitters open the queue read-only for their own agreements.
  const canOpenQueue = allowedViews[data.me.role].includes("queue");
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
              onQueue={() => setView(canOpenQueue ? "queue" : "agreements")}
              onNavigate={(next) =>
                setView(
                  allowedViews[data.me.role].includes(next) ? next : "overview",
                )
              }
              onSelect={(id) => {
                setSelected(id);
                setView(canOpenQueue ? "queue" : "agreements");
              }}
            />
          )}
          {view === "intake" && canSubmit && (
            <Intake busy={busy} submit={post} rules={data.rules} />
          )}{" "}
          {view === "queue" && canOpenQueue && (
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
              findings={findings}
              comments={data.comments}
              role={data.me.role}
              onSelect={canOpenQueue ? (id) => {
                setSelected(id);
                setView("queue");
              } : undefined}
            />
          )}
          {view === "playbook" && data.me.role === "administrator" && <Playbook rules={data.rules} versions={data.playbookVersions} agreements={data.agreements} update={post} />}{" "}
          {view === "reports" && <Reports data={workspaceData} />} {" "}
          {view === "audit" && <AuditLog />}
          {view === "evaluation" && data.me.role === "administrator" && <Evaluation />}
          {view === "profile" && <ProfileAccess me={data.me} users={data.users || []} update={post} />}
        </div>
      </main>
    </div>
  );
}

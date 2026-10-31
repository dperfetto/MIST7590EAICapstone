import { type Agreement, type Audit, type AuditPage, type Data, type EvaluationRun, type Finding, normalizeAnalysisPath, normalizeRole, type Rule } from "@/lib/model";
import { currentUser, supabase } from "@/lib/supabaseClient";
import { localRead } from "@/lib/demoStore";
import { type FindingComment } from "@/lib/comments";
import { type PlaybookVersion } from "@/lib/playbookVersions";
import { readInBatches } from "@/lib/batches";

const camelAgreement = (r: any): Agreement => ({
  id: r.id,
  vendor: r.vendor,
  agreementType: r.agreement_type,
  businessUnit: r.business_unit,
  neededBy: r.needed_by,
  filename: r.filename,
  storageKey: r.storage_key,
  analysisPath: normalizeAnalysisPath(r.analysis_path),
  status: r.status,
  playbookVersion: r.playbook_version,
  createdAt: r.created_at,
});
const camelFinding = (r: any): Finding => ({
  id: r.id,
  agreementId: r.agreement_id,
  provision: r.provision,
  findingType: r.finding_type,
  severity: r.severity,
  confidence: r.confidence,
  sourceText: r.source_text,
  reason: r.reason,
  status: r.status,
  decisionReason: r.decision_reason,
  decidedAt: r.decided_at,
  analysisMethod: r.analysis_method,
});
const camelRule = (r: any): Rule => ({
  id: r.id,
  agreementType: r.agreement_type,
  provision: r.provision,
  applicability: r.applicability,
  standard: r.standard,
  severity: r.severity,
  active: r.active,
});
const camelAudit = (r: any): Audit => ({
  id: r.id,
  agreementId: r.agreement_id,
  actorName: r.actor_name,
  eventType: r.event_type,
  detail: r.detail,
  createdAt: r.created_at,
});
const camelComment = (r: any): FindingComment => ({
  id: r.id,
  findingId: r.finding_id,
  agreementId: r.agreement_id,
  authorName: r.author_name,
  authorRole: r.author_role,
  body: r.body,
  createdAt: r.created_at,
});
const camelPlaybookVersion = (r: any): PlaybookVersion => ({
  agreementType: r.agreement_type,
  version: r.version,
  activeProvisions: r.active_provisions || [],
  summary: r.change_summary,
  changedBy: r.changed_by_name,
  createdAt: r.created_at,
});
// Tables added after the first release: until schema.sql is rerun they do not
// exist, so read them as empty rather than failing the whole workspace.
const missingTable = (error: any) => error?.code === "PGRST205" || error?.code === "42P01";
const optionalTable = (error: any): any[] => {
  if (missingTable(error)) return [];
  throw error;
};
// Read a whole table, in batches (see readInBatches). The last order column
// should be unique so batches neither skip nor repeat rows.
type Order = [column: string, ascending?: boolean];
async function readAll(table: string, order: Order[]) {
  return readInBatches<any>((from, to) => {
    let query = supabase!.from(table).select("*", { count: "exact" });
    for (const [column, ascending = true] of order) query = query.order(column, { ascending });
    return query.range(from, to);
  });
}
export async function getAuditPage(
  page = 1,
  pageSize = 25,
): Promise<AuditPage> {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  if (!supabase) {
    const all = [...localRead().audit].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return {
      events: all.slice(from, to + 1),
      total: all.length,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  await currentUser();
  const { data, error, count } = await supabase
    .from("audit_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    events: (data || []).map(camelAudit),
    total: count ?? 0,
    page: safePage,
    pageSize: safePageSize,
  };
}
// One agreement's audit events, oldest first, for its review record. Row-level
// security limits a Submitter to the events they recorded themselves.
export async function getAgreementActivity(agreementId: string): Promise<Audit[]> {
  if (!supabase) {
    return localRead()
      .audit.filter((event) => event.agreementId === agreementId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const rows = await readInBatches<any>((from, to) =>
    supabase!
      .from("audit_events")
      .select("*", { count: "exact" })
      .eq("agreement_id", agreementId)
      .order("created_at")
      .order("id")
      .range(from, to),
  );
  return rows.map(camelAudit);
}
export async function getAllAuditEvents(): Promise<Audit[]> {
  if (!supabase) {
    return [...localRead().audit].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  await currentUser();
  const batchSize = 1000;
  const rows: any[] = [];

  for (let from = 0; ; from += batchSize) {
    const { data, error } = await supabase
      .from("audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) throw error;

    const batch = data || [];
    rows.push(...batch);
    if (batch.length < batchSize) break;
  }

  return rows.map(camelAudit);
}
// AI evaluation runs (brief Sections 6.1/6.2), loaded into Supabase from
// evaluation/build_ai_check_set_report.py --sql. Row-level security returns
// them to Administrators only; demo mode has none.
export async function getEvaluations(): Promise<EvaluationRun[]> {
  if (!supabase) return [];
  const runs = await supabase
    .from("evaluation_runs")
    .select("*")
    .order("run_at", { ascending: false });
  if (runs.error) throw runs.error;
  const [resultRows, checkRows] = await Promise.all([
    readAll("evaluation_results", [["run_id"], ["contract"], ["provision"]]),
    // Until schema.sql is rerun this table does not exist; show no checks
    // rather than failing the whole page.
    readAll("independent_check_results", [["run_id"], ["document"], ["provision"], ["version"]]).catch(
      (error) => {
        if (missingTable(error)) return [];
        throw error;
      },
    ),
  ]);
  const results = { data: resultRows };
  return (runs.data || []).map((r: any) => ({
    id: r.id,
    kind: r.kind === "independent_check" ? "independent_check" : "cuad_check_set",
    label: r.label,
    runAt: r.run_at,
    model: r.model,
    agreementType: r.agreement_type,
    contracts: r.contracts,
    aiCalls: r.ai_calls,
    aiFallbacks: r.ai_fallbacks,
    notes: r.notes,
    results: (results.data || [])
      .filter((row: any) => row.run_id === r.id)
      .map((row: any) => ({
        contract: row.contract,
        provision: row.provision,
        expertPresent: row.expert_present,
        calderFlagged: row.calder_flagged,
        outcome: row.outcome,
        confidence: row.confidence,
        calderQuote: row.calder_quote,
        quoteOverlaps: row.quote_overlaps,
        expertClause: row.expert_clause,
        keywordFlagged: row.keyword_flagged,
        methodUsed: row.method_used,
      })),
    checks: checkRows
      .filter((row: any) => row.run_id === r.id)
      .map((row: any) => ({
        document: row.document,
        agreementType: row.agreement_type,
        provision: row.provision,
        editType: row.edit_type,
        editDescription: row.edit_description,
        version: row.version,
        expectedPresent: row.expected_present,
        aiFlagged: row.ai_flagged,
        correct: row.correct,
        confidence: row.confidence,
        quoteTouchesEdit: row.quote_touches_edit,
        aiQuote: row.ai_quote,
        keywordCorrect: row.keyword_correct,
        diagnosis: row.diagnosis,
      })),
  }));
}
export async function getWorkspace(): Promise<Data> {
  if (!supabase) return localRead();
  const user = await currentUser();
  // Agreements, findings, comments and playbook versions are read in full
  // (see readAll); the audit log shows the latest 100 here and pages on its own screen.
  const newestFirst: Order[] = [["created_at", false], ["id", false]];
  const [profile, r, au, agreementRows, findingRows, comments, versions] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("playbook_rules").select("*").order("id"),
    supabase
      .from("audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    readAll("agreements", newestFirst),
    readAll("findings", newestFirst),
    readAll("finding_comments", [["created_at"], ["id"]]).catch(optionalTable),
    readAll("playbook_versions", [["version"], ["id"]]).catch(optionalTable),
  ]);
  const failed = [profile, r, au].find((x) => x.error);
  if (failed?.error) throw failed.error;
  if (profile.data.deactivated_at)
    throw new Error("This account has been deactivated. Contact an Administrator if you need access again.");
  const assignedRole = normalizeRole(profile.data.role);
  const users = assignedRole === "administrator"
    ? await readAll("profiles", [["full_name"], ["id"]])
    : [];
  return {
    me: {
      id: user.id,
      name: profile.data.full_name || user.email?.split("@")[0] || "User",
      email: user.email || "",
      role: assignedRole,
    },
    agreements: agreementRows.map(camelAgreement),
    findings: findingRows.map(camelFinding),
    rules: (r.data || []).map(camelRule),
    audit: (au.data || []).map(camelAudit),
    comments: comments.map(camelComment),
    playbookVersions: versions.map(camelPlaybookVersion),
    aiStatus: "manual-ready",
    users: users.map((row) => ({
      id: row.id,
      name: row.full_name || "Unnamed user",
      role: normalizeRole(row.role),
      deactivated: Boolean(row.deactivated_at),
    })),
  };
}

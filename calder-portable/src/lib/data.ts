import { createClient } from "@supabase/supabase-js";

export type UserRole = "submitter" | "reviewer" | "approver" | "administrator";
export const roleLabels: Record<UserRole, string> = {
  submitter: "Submitter",
  reviewer: "Reviewer",
  approver: "Approver",
  administrator: "Administrator",
};
export const normalizeRole = (value: unknown): UserRole =>
  value === "reviewer" || value === "approver" || value === "administrator"
    ? value
    : "submitter";

export type Agreement = {
  id: string;
  vendor: string;
  agreementType: string;
  businessUnit: string;
  neededBy: string;
  filename: string;
  storageKey?: string | null;
  status: string;
  playbookVersion: string;
  createdAt: string;
};
export type Finding = {
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
export type Rule = {
  id: string;
  agreementType: string;
  provision: string;
  applicability: string;
  standard: string;
  method: string;
  severity: string;
  active: boolean;
};
export type Audit = {
  id: string;
  agreementId?: string;
  actorName: string;
  eventType: string;
  detail: string;
  createdAt: string;
};
export type UserProfile = { id: string; name: string; role: UserRole };
export type Data = {
  me: { name: string; email: string; role: UserRole };
  agreements: Agreement[];
  findings: Finding[];
  rules: Rule[];
  audit: Audit[];
  aiStatus: string;
  users?: UserProfile[];
};

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const connected = Boolean(url && key);
export const supabase = connected ? createClient(url, key) : null;
const LOCAL_KEY = "calder-demo-v1";
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const seed: Data = {
  me: {
    name: "Jordan Lee",
    email: "demo.admin@calder.example",
    role: "administrator",
  },
  aiStatus: "manual-ready",
  agreements: [
    {
      id: "agr-1042",
      vendor: "Northstar Cloud Systems",
      agreementType: "SaaS",
      businessUnit: "Corporate IT",
      neededBy: "2026-09-08",
      filename: "Northstar-MSA.pdf",
      status: "in_review",
      playbookVersion: "SaaS v1",
      createdAt: now(),
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
      createdAt: now(),
    },
    {
      id: "agr-1039",
      vendor: "Meridian Analytics",
      agreementType: "DPA",
      businessUnit: "Finance",
      neededBy: "2026-09-15",
      filename: "Meridian-DPA.pdf",
      status: "ready_for_review",
      playbookVersion: "DPA v1",
      createdAt: now(),
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
      createdAt: now(),
    },
  ],
  findings: [
    {
      id: "f-1",
      agreementId: "agr-1042",
      provision: "Renewal Notice",
      findingType: "deviation",
      severity: "high",
      confidence: 94,
      sourceText:
        "This Agreement automatically renews for successive twelve-month periods unless Customer provides written notice at least ninety (90) days before expiration.",
      reason: "90-day non-renewal notice exceeds the SaaS standard of 60 days.",
      status: "open",
    },
    {
      id: "f-2",
      agreementId: "agr-1042",
      provision: "Cap on Liability",
      findingType: "deviation",
      severity: "high",
      confidence: 91,
      sourceText:
        "Vendor's aggregate liability shall not exceed fees paid during the six months preceding the event giving rise to the claim.",
      reason: "Six-month fee cap differs from the approved SaaS standard.",
      status: "open",
    },
    {
      id: "f-3",
      agreementId: "agr-1042",
      provision: "Governing Law",
      findingType: "acceptable",
      severity: "low",
      confidence: 98,
      sourceText:
        "This Agreement is governed by the laws of the State of Georgia.",
      reason: "Georgia is an approved jurisdiction.",
      status: "accepted",
      decisionReason: "Clause meets the approved standard.",
    },
    {
      id: "f-4",
      agreementId: "agr-1041",
      provision: "Insurance",
      findingType: "gap",
      severity: "high",
      confidence: 72,
      sourceText: "No responsive insurance provision detected.",
      reason: "Insurance is required for Professional Services agreements.",
      status: "escalated",
      decisionReason: "Coverage must be confirmed before approval.",
    },
    {
      id: "f-5",
      agreementId: "agr-1039",
      provision: "Audit Rights",
      findingType: "gap",
      severity: "high",
      confidence: 64,
      sourceText: "No responsive audit or assurance provision detected.",
      reason:
        "DPA playbook requires an acceptable audit or assurance mechanism.",
      status: "open",
    },
  ],
  rules: [
    [
      "SaaS",
      "Cap on Liability",
      "R",
      "Cap required; compare basis, amount, and carve-outs",
      "Hybrid",
      "High",
    ],
    [
      "SaaS",
      "Auto Renewal",
      "M",
      "Monitor renewal term; absence is acceptable",
      "Hybrid",
      "Medium",
    ],
    [
      "SaaS",
      "Renewal Notice",
      "C",
      "If auto-renewal exists, notice should be 60 days or less",
      "Regex + AI",
      "High",
    ],
    [
      "SaaS",
      "Governing Law",
      "R",
      "Approved US jurisdiction required",
      "Regex",
      "Medium",
    ],
    [
      "SaaS",
      "Exclusivity",
      "M",
      "Any exclusivity requires review",
      "AI",
      "High",
    ],
    [
      "Professional Services",
      "Cap on Liability",
      "R",
      "Cap required and must match approved PSA allocation",
      "Hybrid",
      "High",
    ],
    [
      "Professional Services",
      "Termination for Convenience",
      "R",
      "Customer convenience termination expected",
      "AI",
      "High",
    ],
    [
      "Professional Services",
      "Insurance",
      "R",
      "CGL and professional coverage required",
      "Hybrid",
      "High",
    ],
    [
      "Professional Services",
      "Warranty Duration",
      "R",
      "Services warranty and remedy required",
      "Hybrid",
      "Medium",
    ],
    [
      "DPA",
      "Cap on Liability",
      "R",
      "Data exposure must match approved DPA standard",
      "Hybrid",
      "High",
    ],
    [
      "DPA",
      "Audit Rights",
      "R",
      "Acceptable audit or assurance mechanism required",
      "AI",
      "High",
    ],
    [
      "DPA",
      "Insurance",
      "C",
      "Cyber coverage required for elevated risk tier",
      "Hybrid",
      "High",
    ],
    [
      "DPA",
      "Assignment / Control",
      "C",
      "Processing obligations must survive transfer or control change",
      "AI",
      "High",
    ],
    [
      "DPA",
      "Governing Law",
      "R",
      "DPA or incorporated agreement must provide governing law",
      "Regex",
      "Medium",
    ],
  ].map((r, i) => ({
    id: `rule-${i + 1}`,
    agreementType: r[0],
    provision: r[1],
    applicability: r[2],
    standard: r[3],
    method: r[4],
    severity: r[5],
    active: true,
  })),
  audit: [
    {
      id: uid(),
      agreementId: "agr-1042",
      actorName: "Jordan Lee",
      eventType: "Agreement submitted",
      detail: "SaaS agreement submitted for Corporate IT.",
      createdAt: now(),
    },
    {
      id: uid(),
      agreementId: "agr-1042",
      actorName: "Analysis service",
      eventType: "Analysis completed",
      detail: "3 provisions identified using SaaS v1; 2 deviations surfaced.",
      createdAt: now(),
    },
  ],
};

const cloneSeed = () => JSON.parse(JSON.stringify(seed)) as Data;
function localRead() {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) {
    const value = cloneSeed();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
    return value;
  }
  return JSON.parse(raw) as Data;
}
function localWrite(value: Data) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
}
const camelAgreement = (r: any): Agreement => ({
  id: r.id,
  vendor: r.vendor,
  agreementType: r.agreement_type,
  businessUnit: r.business_unit,
  neededBy: r.needed_by,
  filename: r.filename,
  storageKey: r.storage_key,
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
  analysisMethod: r.analysis_method,
});
const camelRule = (r: any): Rule => ({
  id: r.id,
  agreementType: r.agreement_type,
  provision: r.provision,
  applicability: r.applicability,
  standard: r.standard,
  method: r.method,
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

async function currentUser() {
  const { data, error } = await supabase!.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in to continue.");
  return data.user;
}
export async function getWorkspace(): Promise<Data> {
  if (!supabase) return localRead();
  const user = await currentUser();
  const [profile, a, f, r, au] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("agreements")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("findings")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("playbook_rules").select("*").order("id"),
    supabase
      .from("audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const failed = [profile, a, f, r, au].find((x) => x.error);
  if (failed?.error) throw failed.error;
  const assignedRole = normalizeRole(profile.data.role);
  const users = assignedRole === "administrator"
    ? await supabase.from("profiles").select("id,full_name,role").order("full_name")
    : { data: [], error: null };
  if (users.error) throw users.error;
  return {
    me: {
      name: profile.data.full_name || user.email?.split("@")[0] || "User",
      email: user.email || "",
      role: assignedRole,
    },
    agreements: (a.data || []).map(camelAgreement),
    findings: (f.data || []).map(camelFinding),
    rules: (r.data || []).map(camelRule),
    audit: (au.data || []).map(camelAudit),
    aiStatus: "manual-ready",
    users: (users.data || []).map((row) => ({
      id: row.id,
      name: row.full_name || "Unnamed user",
      role: normalizeRole(row.role),
    })),
  };
}

export async function performAction(body: Record<string, unknown>) {
  if (!supabase) {
    const d = localRead();
    const actor = d.me.name;
    if (body.action === "update_profile") {
      d.me.name = String(body.name || d.me.name).trim() || d.me.name;
      d.audit.unshift({
        id: uid(),
        actorName: d.me.name,
        eventType: "Profile updated",
        detail: "User updated their profile details.",
        createdAt: now(),
      });
      localWrite(d);
      return;
    }
    if (body.action === "assign_role") {
      if (d.me.role !== "administrator") throw new Error("Administrator access required.");
      const target = d.users?.find((user) => user.id === body.userId);
      if (target) target.role = normalizeRole(body.role);
      localWrite(d);
      return;
    }
    if ((body.action === "decide_finding" || body.action === "add_manual_finding") && !["reviewer", "approver", "administrator"].includes(d.me.role))
      throw new Error("Reviewer access required.");
    if (body.action === "update_rule" && d.me.role !== "administrator")
      throw new Error("Administrator access required.");
    if (body.action === "create_agreement") {
      const id = String(
        body.id || `agr-${Math.floor(1000 + Math.random() * 8999)}`,
      );
      d.agreements.unshift({
        id,
        vendor: String(body.vendor),
        agreementType: String(body.agreementType),
        businessUnit: String(body.businessUnit),
        neededBy: String(body.neededBy),
        filename: String(body.filename || "Manual intake"),
        storageKey: String(body.storageKey || ""),
        status: String(body.status || "manual_review_required"),
        playbookVersion: `${body.agreementType} v1`,
        createdAt: now(),
      });
      d.audit.unshift({
        id: uid(),
        agreementId: id,
        actorName: actor,
        eventType: "Agreement submitted",
        detail: `${body.agreementType} agreement submitted using ${body.analysisMethod || "manual"} analysis.`,
        createdAt: now(),
      });
    }
    if (body.action === "decide_finding") {
      const f = d.findings.find((x) => x.id === body.findingId);
      if (f) {
        f.status = String(body.decision);
        f.decisionReason = String(body.reason);
        d.audit.unshift({
          id: uid(),
          agreementId: f.agreementId,
          actorName: actor,
          eventType: `Finding ${body.decision}`,
          detail: `${f.provision}: ${body.reason}`,
          createdAt: now(),
        });
      }
    }
    if (body.action === "add_manual_finding") {
      d.findings.unshift({
        id: uid(),
        agreementId: String(body.agreementId),
        provision: String(body.provision),
        findingType: String(body.findingType),
        severity: String(body.severity),
        confidence: 100,
        sourceText: String(body.sourceText),
        reason: String(body.reason),
        status: "open",
        analysisMethod: "manual",
      });
      d.audit.unshift({
        id: uid(),
        agreementId: String(body.agreementId),
        actorName: actor,
        eventType: "Manual finding added",
        detail: `${body.provision} added with source evidence.`,
        createdAt: now(),
      });
    }
    if (body.action === "add_analysis_findings") {
      const rows = Array.isArray(body.findings) ? (body.findings as any[]) : [];
      for (const row of rows)
        d.findings.unshift({
          id: uid(),
          agreementId: String(body.agreementId),
          provision: String(row.provision),
          findingType: String(row.findingType),
          severity: String(row.severity),
          confidence: Number(row.confidence),
          sourceText: String(row.sourceText),
          reason: String(row.reason),
          status: "open",
          analysisMethod: String(row.analysisMethod),
        });
      d.audit.unshift({
        id: uid(),
        agreementId: String(body.agreementId),
        actorName: actor,
        eventType: "Analysis completed",
        detail: `${rows.length} ${body.analysisMethod} findings created for human verification.`,
        createdAt: now(),
      });
    }
    if (body.action === "update_rule") {
      const r = d.rules.find((x) => x.id === body.ruleId);
      if (r) r.active = Boolean(body.active);
    }
    localWrite(d);
    return;
  }
  const user = await currentUser();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name,role")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;
  const role = normalizeRole(profile.role);
  const actor = profile.full_name || user.email || "User";
  if (body.action === "update_profile") {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: String(body.name || actor).trim(),
        updated_at: now(),
      })
      .eq("id", user.id);
    if (error) throw error;
    return;
  }
  if (body.action === "assign_role") {
    if (role !== "administrator") throw new Error("Administrator access required.");
    const { error } = await supabase.rpc("assign_user_role", {
      target_user: body.userId,
      new_role: normalizeRole(body.role),
    });
    if (error) throw error;
    return;
  }
  if ((body.action === "decide_finding" || body.action === "add_manual_finding") && !["reviewer", "approver", "administrator"].includes(role))
    throw new Error("Reviewer access required.");
  if (body.action === "update_rule" && role !== "administrator")
    throw new Error("Administrator access required.");
  if (body.action === "create_agreement") {
    const id = String(
      body.id || `agr-${Math.floor(1000 + Math.random() * 8999)}`,
    );
    const { error } = await supabase
      .from("agreements")
      .insert({
        id,
        user_id: user.id,
        vendor: body.vendor,
        agreement_type: body.agreementType,
        business_unit: body.businessUnit,
        needed_by: body.neededBy,
        filename: body.filename || "Manual intake",
        storage_key: body.storageKey || null,
        status: body.status || "manual_review_required",
        playbook_version: `${body.agreementType} v1`,
      });
    if (error) throw error;
    await supabase
      .from("audit_events")
      .insert({
        agreement_id: id,
        user_id: user.id,
        actor_name: actor,
        event_type: "Agreement submitted",
        detail: `${body.agreementType} agreement submitted using ${body.analysisMethod || "manual"} analysis.`,
      });
    return;
  }
  if (body.action === "decide_finding") {
    const { data: f, error: q } = await supabase
      .from("findings")
      .select("agreement_id,provision")
      .eq("id", body.findingId)
      .single();
    if (q) throw q;
    const { error } = await supabase
      .from("findings")
      .update({
        status: body.decision,
        decision_reason: body.reason,
        decided_at: now(),
      })
      .eq("id", body.findingId);
    if (error) throw error;
    await supabase
      .from("audit_events")
      .insert({
        agreement_id: f.agreement_id,
        user_id: user.id,
        actor_name: actor,
        event_type: `Finding ${body.decision}`,
        detail: `${f.provision}: ${body.reason}`,
      });
    return;
  }
  if (body.action === "add_manual_finding") {
    const { error } = await supabase
      .from("findings")
      .insert({
        user_id: user.id,
        agreement_id: body.agreementId,
        provision: body.provision,
        finding_type: body.findingType,
        severity: body.severity,
        confidence: 100,
        source_text: body.sourceText,
        reason: body.reason,
        status: "open",
        analysis_method: "manual",
      });
    if (error) throw error;
    return;
  }
  if (body.action === "add_analysis_findings") {
    const rows = (
      Array.isArray(body.findings) ? body.findings : ([] as any[])
    ).map((row: any) => ({
      user_id: user.id,
      agreement_id: body.agreementId,
      provision: row.provision,
      finding_type: row.findingType,
      severity: row.severity,
      confidence: row.confidence,
      source_text: row.sourceText,
      reason: row.reason,
      status: "open",
      analysis_method: row.analysisMethod,
    }));
    if (rows.length) {
      const { error } = await supabase.from("findings").insert(rows);
      if (error) throw error;
    }
    await supabase
      .from("audit_events")
      .insert({
        agreement_id: body.agreementId,
        user_id: user.id,
        actor_name: actor,
        event_type: "Analysis completed",
        detail: `${rows.length} ${body.analysisMethod} findings created for human verification.`,
      });
    return;
  }
  if (body.action === "update_rule") {
    const { error } = await supabase
      .from("playbook_rules")
      .update({ active: body.active })
      .eq("id", body.ruleId);
    if (error) throw error;
  }
}

export async function uploadPdf(file: File) {
  const supported =
    file.type === "application/pdf" ||
    file.type === "text/plain" ||
    /\.(pdf|txt)$/i.test(file.name);
  if (!supported || file.size > 10 * 1024 * 1024)
    throw new Error("Upload a PDF or TXT file no larger than 10 MB.");
  if (!supabase)
    return {
      filename: file.name,
      key: `local-demo/${Date.now()}-${file.name}`,
    };
  const user = await currentUser();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from("agreements")
    .upload(path, file, { contentType: file.type || "text/plain" });
  if (error) throw error;
  return { filename: file.name, key: path };
}

export function resetLocalDemo() {
  localStorage.removeItem(LOCAL_KEY);
  location.reload();
}

export function installWorkspaceApi() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.pathname
          : input.url;
    if (!requestUrl.endsWith("/api/workspace")) return nativeFetch(input, init);
    try {
      const method = (init?.method || "GET").toUpperCase();
      if (method === "GET") return Response.json(await getWorkspace());
      if (method === "POST") {
        await performAction(JSON.parse(String(init?.body || "{}")));
        return Response.json({ ok: true });
      }
      if (method === "PUT") {
        const form = init?.body as FormData;
        const file = form?.get("file");
        if (!(file instanceof File)) throw new Error("Choose a PDF.");
        const result = await uploadPdf(file);
        return Response.json({
          ok: true,
          filename: result.filename,
          key: result.key,
        });
      }
      return Response.json({ error: "Unsupported action" }, { status: 400 });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Unexpected error" },
        { status: 500 },
      );
    }
  };
}

import { taxonomy } from "./candidateRetrieval";
import { currentUser, supabase } from "@/lib/supabaseClient";
import { localRead, localWrite, now, uid } from "@/lib/demoStore";
import { agreementReviewStatus, normalizeAnalysisPath, normalizeRole } from "@/lib/model";
import { saveLocalFile } from "./agreementFiles";

// A manual confidence of 0 is a real value; only a missing or non-numeric
// entry falls back to 100.
const manualConfidence = (value: unknown) => {
  const confidence = value === "" || value == null ? NaN : Number(value);
  return Number.isFinite(confidence)
    ? Math.max(0, Math.min(100, confidence))
    : 100;
};
const manualFindingDetail = (body: Record<string, unknown>) =>
  body.sourceVerified
    ? `${body.provision} added; source text verified against the stored agreement.`
    : `${body.provision} added; source text could not be verified because the agreement file was unavailable.`;
export async function performAction(body: Record<string, unknown>) {
  const decisionReason = String(body.reason ?? "").trim();
  if (body.action === "decide_finding" && !decisionReason)
    throw new Error("A reason is required for this decision.");
  if (body.action === "add_manual_finding") {
    if (!taxonomy.some((entry) => entry.calderProvision === body.provision))
      throw new Error("Choose a provision from the playbook categories.");
    if (!String(body.sourceText ?? "").trim())
      throw new Error("Paste the exact source text from the agreement.");
  }

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
        analysisPath: normalizeAnalysisPath(body.analysisPath),
        status: String(body.status || "manual_review_required"),
        playbookVersion: `${body.agreementType} v1`,
        createdAt: now(),
      });
      d.audit.unshift({
        id: uid(),
        agreementId: id,
        actorName: actor,
        eventType: "Agreement submitted",
        detail: `${body.agreementType} agreement stored; analysis runs as a separate workflow step.`,
        createdAt: now(),
      });
    }
    if (body.action === "decide_finding") {
      const f = d.findings.find((x) => x.id === body.findingId);
      if (f?.status === "escalated" && body.decision === "escalated")
        throw new Error("An escalated finding must be accepted or dismissed.");
      if (f) {
        f.status = String(body.decision);
        f.decisionReason = decisionReason;
        const agreement = d.agreements.find((item) => item.id === f.agreementId);
        if (agreement) {
          const nextStatus = agreementReviewStatus(
            d.findings
              .filter((finding) => finding.agreementId === agreement.id)
              .map((finding) => finding.status),
            agreement.status,
          );
          if (nextStatus !== agreement.status) {
            agreement.status = nextStatus;
            d.audit.unshift({
              id: uid(),
              agreementId: agreement.id,
              actorName: actor,
              eventType:
                nextStatus === "approved"
                  ? "Agreement approved"
                  : nextStatus === "escalated"
                    ? "Agreement escalated"
                    : nextStatus === "review_complete"
                      ? "Agreement review completed"
                      : "Agreement review in progress",
              detail: `Agreement status updated to ${nextStatus.replaceAll("_", " ")}.`,
              createdAt: now(),
            });
          }
        }
        d.audit.unshift({
          id: uid(),
          agreementId: f.agreementId,
          actorName: actor,
          eventType: `Finding ${body.decision}`,
          detail: `${f.provision}: ${decisionReason}`,
          createdAt: now(),
        });
      }
    }
    if (body.action === "add_manual_finding") {
      d.findings.unshift({
        id: uid(),
        agreementId: String(body.agreementId),
        provision: String(body.provision),
        findingType: "present",
        severity: "medium",
        confidence: manualConfidence(body.confidence),
        sourceText: String(body.sourceText),
        reason: String(body.reason || "Provision language identified manually."),
        status: "open",
        analysisMethod: "manual",
      });
      d.audit.unshift({
        id: uid(),
        agreementId: String(body.agreementId),
        actorName: actor,
        eventType: "Manual finding added",
        detail: manualFindingDetail(body),
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
          findingType: "present",
          severity: "medium",
          confidence: Number(row.confidence),
          sourceText: String(row.sourceText),
          reason: String(row.reason || "Provision language identified for human verification."),
          status: "open",
          analysisMethod: String(row.analysisMethod),
        });
      d.audit.unshift({
        id: uid(),
        agreementId: String(body.agreementId),
        actorName: actor,
        eventType: "Analysis completed",
        detail: `${rows.length} ${body.analysisMethod} presence findings created for human verification.${body.analysisDurationMs ? ` Analysis completed in ${body.analysisDurationMs} ms.` : ""}`,
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
        analysis_path: normalizeAnalysisPath(body.analysisPath),
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
        detail: `${body.agreementType} agreement stored; analysis runs as a separate workflow step.`,
      });
    return;
  }
  if (body.action === "decide_finding") {
    const { data: f, error: q } = await supabase
      .from("findings")
      .select("agreement_id,provision,status")
      .eq("id", body.findingId)
      .single();
    if (q) throw q;
    if (f.status === "escalated" && body.decision === "escalated")
      throw new Error("An escalated finding must be accepted or dismissed.");
    const { error } = await supabase
      .from("findings")
      .update({
        status: body.decision,
        decision_reason: decisionReason,
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
        detail: `${f.provision}: ${decisionReason}`,
      });
    const [{ data: findingStatuses, error: findingsError }, { data: agreement, error: agreementError }] = await Promise.all([
      supabase
        .from("findings")
        .select("status")
        .eq("agreement_id", f.agreement_id),
      supabase
        .from("agreements")
        .select("status")
        .eq("id", f.agreement_id)
        .single(),
    ]);
    if (findingsError) throw findingsError;
    if (agreementError) throw agreementError;
    const nextStatus = agreementReviewStatus(
      (findingStatuses || []).map((finding) => finding.status),
      agreement.status,
    );
    if (nextStatus !== agreement.status) {
      const { error: statusError } = await supabase
        .from("agreements")
        .update({ status: nextStatus })
        .eq("id", f.agreement_id);
      if (statusError) throw statusError;
      await supabase.from("audit_events").insert({
        agreement_id: f.agreement_id,
        user_id: user.id,
        actor_name: actor,
        event_type:
          nextStatus === "approved"
            ? "Agreement approved"
            : nextStatus === "escalated"
              ? "Agreement escalated"
              : nextStatus === "review_complete"
                ? "Agreement review completed"
                : "Agreement review in progress",
        detail: `Agreement status updated to ${nextStatus.replaceAll("_", " ")}.`,
      });
    }
    return;
  }
  if (body.action === "add_manual_finding") {
    const { error } = await supabase
      .from("findings")
      .insert({
        user_id: user.id,
        agreement_id: body.agreementId,
        provision: body.provision,
        finding_type: "present",
        severity: "medium",
        confidence: manualConfidence(body.confidence),
        source_text: body.sourceText,
        reason: body.reason || "Provision language identified manually.",
        status: "open",
        analysis_method: "manual",
      });
    if (error) throw error;
    await supabase.from("audit_events").insert({
      agreement_id: body.agreementId,
      user_id: user.id,
      actor_name: actor,
      event_type: "Manual finding added",
      detail: manualFindingDetail(body),
    });
    return;
  }
  if (body.action === "add_analysis_findings") {
    const rows = (
      Array.isArray(body.findings) ? body.findings : ([] as any[])
    ).map((row: any) => ({
      user_id: user.id,
      agreement_id: body.agreementId,
      provision: row.provision,
      finding_type: "present",
      severity: "medium",
      confidence: row.confidence,
      source_text: row.sourceText,
      reason: row.reason || "Provision language identified for human verification.",
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
        detail: `${rows.length} ${body.analysisMethod} presence findings created for human verification.${body.analysisDurationMs ? ` Analysis completed in ${body.analysisDurationMs} ms.` : ""}`,
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
  if (!supabase) {
    const key = `local-demo/${Date.now()}-${file.name}`;
    // Keep the file in this browser so the review queue can show it.
    await saveLocalFile(key, file);
    return { filename: file.name, key };
  }
  const user = await currentUser();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from("agreements")
    .upload(path, file, { contentType: file.type || "text/plain" });
  if (error) throw error;
  return { filename: file.name, key: path };
}

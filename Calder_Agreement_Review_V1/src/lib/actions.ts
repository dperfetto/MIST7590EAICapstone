import { taxonomy } from "./candidateRetrieval";
import { currentUser, supabase } from "@/lib/supabaseClient";
import { localRead, localWrite, now, uid } from "@/lib/demoStore";
import { agreementReviewStatus, normalizeAnalysisPath, normalizeRole } from "@/lib/model";
import { saveLocalFile } from "./agreementFiles";
import { commentPreview, validateComment } from "./comments";
import { latestVersion, nextVersion, versionLabel } from "./playbookVersions";

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
const reevaluationDetail = (body: Record<string, unknown>, label: string, created: number) => {
  const strings = (value: unknown) => (Array.isArray(value) ? value : []).map(String);
  const [added, checked, removed] = [strings(body.added), strings(body.checked), strings(body.removed)];
  return [
    `Re-evaluated under ${label}.`,
    added.length ? `Added since the review: ${added.join(", ")}.` : "",
    checked.length ? `Analysis checked ${checked.join(", ")}: ${created} new finding${created === 1 ? "" : "s"}.` : "",
    removed.length ? `No longer in the playbook: ${removed.join(", ")} (earlier findings and decisions kept).` : "",
    body.note ? String(body.note) : "",
  ].filter(Boolean).join(" ");
};
// New findings reopen the review; otherwise the status stands.
const reevaluatedStatus = (current: string, created: number) =>
  created ? (current === "escalated" ? "escalated" : "in_review") : current;
// Escalations go to an Approver; Reviewers can escalate but not resolve them.
// schema.sql enforces the same rule on the server.
const canResolveEscalation = (role: string) => ["approver", "administrator"].includes(role);
const analysisRows = (body: Record<string, unknown>) =>
  Array.isArray(body.findings) ? (body.findings as any[]) : [];
export async function performAction(body: Record<string, unknown>) {
  const decisionReason = String(body.reason ?? "").trim();
  if (body.action === "decide_finding" && !decisionReason)
    throw new Error("A reason is required for this decision.");
  const comment = body.action === "add_comment" ? validateComment(body.body) : null;
  if (comment && !comment.ok) throw new Error(comment.error);
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
    // Mirrors remove_user_account in schema.sql: delete an account with no
    // history, otherwise deactivate it. Demo records carry names, not user ids.
    if (body.action === "remove_user" || body.action === "reactivate_user") {
      if (d.me.role !== "administrator") throw new Error("Administrator access required.");
      if (body.userId === d.me.id) throw new Error("You cannot remove your own account.");
      const target = d.users?.find((user) => user.id === body.userId);
      if (!target) throw new Error("Account not found.");
      const hasHistory =
        d.audit.some((event) => event.actorName === target.name) ||
        d.comments.some((comment) => comment.authorName === target.name);
      let eventType = "Account reactivated";
      let detail = `${target.name}'s account was reactivated with its previous role.`;
      if (body.action === "reactivate_user") target.deactivated = false;
      else if (hasHistory) {
        target.deactivated = true;
        eventType = "Account deactivated";
        detail = `${target.name}'s account was deactivated. It has review history, so it was kept for the record and can no longer sign in.`;
      } else {
        d.users = d.users?.filter((user) => user.id !== target.id);
        eventType = "Account deleted";
        detail = `${target.name}'s account was deleted. It had no agreements, decisions or audit history.`;
      }
      d.audit.unshift({ id: uid(), actorName: actor, eventType, detail, createdAt: now() });
      localWrite(d);
      return;
    }
    if (["decide_finding", "add_manual_finding", "reevaluate_agreement"].includes(String(body.action)) && !["reviewer", "approver", "administrator"].includes(d.me.role))
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
        playbookVersion: versionLabel(
          String(body.agreementType),
          latestVersion(d.playbookVersions, String(body.agreementType))?.version ?? 1,
        ),
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
      if (f?.status === "escalated" && !canResolveEscalation(d.me.role))
        throw new Error("Only an Approver can resolve an escalated finding.");
      if (f) {
        f.status = String(body.decision);
        f.decisionReason = decisionReason;
        f.decidedAt = now();
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
      if (r && r.active !== Boolean(body.active)) {
        r.active = Boolean(body.active);
        const version = nextVersion(
          d.playbookVersions,
          r.agreementType,
          d.rules.filter((rule) => rule.agreementType === r.agreementType && rule.active).map((rule) => rule.provision),
          `${r.provision} switched ${r.active ? "on" : "off"}`,
          actor,
          now(),
        );
        d.playbookVersions.push(version);
        d.audit.unshift({
          id: uid(),
          actorName: actor,
          eventType: "Playbook updated",
          detail: `${versionLabel(r.agreementType, version.version)}: ${version.summary}.`,
          createdAt: now(),
        });
      }
    }
    if (body.action === "add_comment" && comment?.ok) {
      const f = d.findings.find((x) => x.id === body.findingId);
      if (!f) throw new Error("That finding no longer exists.");
      d.comments.push({
        id: uid(),
        findingId: f.id,
        agreementId: f.agreementId,
        authorName: actor,
        authorRole: d.me.role,
        body: comment.body,
        createdAt: now(),
      });
      d.audit.unshift({
        id: uid(),
        agreementId: f.agreementId,
        actorName: actor,
        eventType: "Comment added",
        detail: `${f.provision}: ${commentPreview(comment.body)}`,
        createdAt: now(),
      });
    }
    if (body.action === "reevaluate_agreement") {
      const agreement = d.agreements.find((x) => x.id === body.agreementId);
      if (!agreement) throw new Error("That agreement no longer exists.");
      const latest = latestVersion(d.playbookVersions, agreement.agreementType);
      const label = versionLabel(agreement.agreementType, latest?.version ?? 1);
      const rows = analysisRows(body);
      for (const row of rows)
        d.findings.unshift({
          id: uid(),
          agreementId: agreement.id,
          provision: String(row.provision),
          findingType: "present",
          severity: "medium",
          confidence: Number(row.confidence),
          sourceText: String(row.sourceText),
          reason: String(row.reason || "Provision language identified for human verification."),
          status: "open",
          analysisMethod: String(row.analysisMethod),
        });
      agreement.playbookVersion = label;
      agreement.status = reevaluatedStatus(agreement.status, rows.length);
      d.audit.unshift({
        id: uid(),
        agreementId: agreement.id,
        actorName: actor,
        eventType: "Agreement re-evaluated",
        detail: reevaluationDetail(body, label, rows.length),
        createdAt: now(),
      });
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
  if (body.action === "remove_user" || body.action === "reactivate_user") {
    if (role !== "administrator") throw new Error("Administrator access required.");
    const { error } = await supabase.rpc(
      body.action === "remove_user" ? "remove_user_account" : "reactivate_user_account",
      { target_user: body.userId },
    );
    if (error) throw error;
    return;
  }
  if (["decide_finding", "add_manual_finding", "reevaluate_agreement"].includes(String(body.action)) && !["reviewer", "approver", "administrator"].includes(role))
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
        playbook_version: versionLabel(String(body.agreementType), await currentPlaybookVersion(String(body.agreementType))),
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
    if (f.status === "escalated" && !canResolveEscalation(role))
      throw new Error("Only an Approver can resolve an escalated finding.");
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
    // The on_playbook_rule_toggled trigger records the new playbook version.
    const { data: rule, error } = await supabase
      .from("playbook_rules")
      .update({ active: body.active })
      .eq("id", body.ruleId)
      .select("agreement_type,provision")
      .single();
    if (error) throw error;
    await supabase.from("audit_events").insert({
      user_id: user.id,
      actor_name: actor,
      event_type: "Playbook updated",
      detail: `${versionLabel(rule.agreement_type, await currentPlaybookVersion(rule.agreement_type))}: ${rule.provision} switched ${body.active ? "on" : "off"}.`,
    });
    return;
  }
  if (body.action === "add_comment" && comment?.ok) {
    const { data: f, error: q } = await supabase
      .from("findings")
      .select("agreement_id,provision")
      .eq("id", body.findingId)
      .single();
    if (q) throw q;
    const { error } = await supabase.from("finding_comments").insert({
      finding_id: body.findingId,
      agreement_id: f.agreement_id,
      user_id: user.id,
      author_name: actor,
      author_role: role,
      body: comment.body,
    });
    if (error) throw error;
    await supabase.from("audit_events").insert({
      agreement_id: f.agreement_id,
      user_id: user.id,
      actor_name: actor,
      event_type: "Comment added",
      detail: `${f.provision}: ${commentPreview(comment.body)}`,
    });
    return;
  }
  if (body.action === "reevaluate_agreement") {
    const { data: agreement, error: q } = await supabase
      .from("agreements")
      .select("id,agreement_type,status")
      .eq("id", body.agreementId)
      .single();
    if (q) throw q;
    const label = versionLabel(agreement.agreement_type, await currentPlaybookVersion(agreement.agreement_type));
    const rows = analysisRows(body).map((row: any) => ({
      user_id: user.id,
      agreement_id: agreement.id,
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
    const { error } = await supabase
      .from("agreements")
      .update({
        playbook_version: label,
        status: reevaluatedStatus(agreement.status, rows.length),
        updated_at: now(),
      })
      .eq("id", agreement.id);
    if (error) throw error;
    await supabase.from("audit_events").insert({
      agreement_id: agreement.id,
      user_id: user.id,
      actor_name: actor,
      event_type: "Agreement re-evaluated",
      detail: reevaluationDetail(body, label, rows.length),
    });
  }
}
// The newest recorded version for a contract type; 1 until schema.sql adds
// the playbook_versions table.
async function currentPlaybookVersion(agreementType: string) {
  const { data, error } = await supabase!
    .from("playbook_versions")
    .select("version")
    .eq("agreement_type", agreementType)
    .order("version", { ascending: false })
    .limit(1);
  if (error) return 1;
  return data?.[0]?.version ?? 1;
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

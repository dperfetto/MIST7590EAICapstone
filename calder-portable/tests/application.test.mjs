import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspace = await readFile(
  new URL("../src/Workspace.tsx", import.meta.url),
  "utf8",
);
const data = await readFile(
  new URL("../src/lib/data.ts", import.meta.url),
  "utf8",
);
const analyzer = await readFile(
  new URL("../src/lib/analyze.ts", import.meta.url),
  "utf8",
);
const aiEndpoint = await readFile(
  new URL("../api/analyze.js", import.meta.url),
  "utf8",
);
const styles = await readFile(
  new URL("../src/styles.css", import.meta.url),
  "utf8",
);
const shell = await readFile(
  new URL("../src/slabstax-shell.css", import.meta.url),
  "utf8",
);
const main = await readFile(
  new URL("../src/main.tsx", import.meta.url),
  "utf8",
);
const schema = await readFile(
  new URL("../supabase/schema.sql", import.meta.url),
  "utf8",
);
const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

test("all role-aware work areas remain available", () => {
  for (const view of [
    "overview",
    "intake",
    "queue",
    "agreements",
    "playbook",
    "reports",
    "audit",
    "profile",
  ]) {
    assert.match(workspace, new RegExp(`\\[\\"${view}\\"`));
  }
});

test("SlabStaX-style sidebar has synchronized open and collapsed widths", () => {
  assert.match(shell, /--calder-sidebar-open:\s*286px/);
  assert.match(shell, /--calder-sidebar-closed:\s*76px/);
  assert.match(
    shell,
    /grid-template-columns:\s*var\(--calder-sidebar-open\)\s+minmax\(0,\s*1fr\)/,
  );
  assert.match(
    shell,
    /grid-template-areas:\s*"calder-sidebar calder-workspace"/,
  );
  assert.match(shell, /grid-area:\s*calder-sidebar/);
  assert.match(shell, /grid-area:\s*calder-workspace/);
  assert.match(shell, /grid-column:\s*1\s*!important/);
  assert.match(shell, /grid-column:\s*2\s*!important/);
  assert.match(shell, /\.app-shell\.sidebar-collapsed/);
  assert.match(shell, /\.sidebar\.collapsed/);
  assert.match(workspace, /setSidebarOpen\(\(open\) => !open\)/);
  assert.doesNotMatch(
    styles,
    /grid-template-columns:\s*repeat\(7|min-width:\s*112px|Final header architecture/,
    "legacy horizontal-toolbar CSS must never return",
  );
});

test("mobile navigation uses a drawer and dismissible backdrop", () => {
  assert.match(shell, /@media \(max-width:\s*700px\)/);
  assert.match(shell, /\.sidebar-backdrop/);
  assert.match(workspace, /aria-label="Close navigation"/);
  assert.match(workspace, /aria-label="Open navigation"/);
});

test("Calder palette and the new shell stylesheet are active", () => {
  assert.match(shell, /--calder-text:\s*#17243a/);
  assert.match(shell, /--calder-accent:\s*#0b6676/);
  assert.match(main, /import "\.\/slabstax-shell\.css"/);
});

test("authentication is a polished responsive form, not an unstyled fallback", () => {
  assert.match(app, /className="auth-shell"/);
  assert.match(app, /className="auth-intro"/);
  assert.match(app, /<form onSubmit=/);
  assert.match(app, /htmlFor="email"/);
  assert.match(app, /autoComplete="email"/);
  assert.match(app, /Submitter access by default/);
  assert.match(shell, /\.auth-page\s*\{/);
  assert.match(shell, /\.auth-shell\s*\{/);
  assert.match(shell, /\.auth-card\s*\{/);
  assert.match(shell, /@media \(max-width: 820px\)/);
  assert.match(shell, /@media \(max-width: 520px\)/);
});

test("contract-type playbooks cover SaaS, Professional Services, and DPA", () => {
  for (const contractType of ["SaaS", "Professional Services", "DPA"]) {
    assert.ok(
      data.includes(`"${contractType}"`) && analyzer.includes(contractType),
    );
  }
  assert.match(data, /playbook_rules/);
  assert.match(data, /applicability/);
});

test("local and hosted workflows retain every core mutation", () => {
  for (const action of [
    "create_agreement",
    "decide_finding",
    "add_manual_finding",
    "update_rule",
  ]) {
    const matches =
      data.match(new RegExp(`body\\.action\\s*===\\s*"${action}"`, "g")) ?? [];
    assert.ok(matches.length >= 2, action + " must exist in local and Supabase paths");
  }
  assert.match(data, /audit_events/);
  assert.match(data, /localWrite\(d\)/);
});

test("PDF upload safety and manual fallback remain enforced", () => {
  assert.match(analyzer, /application\/pdf/);
  assert.match(analyzer, /text\/plain/);
  assert.match(analyzer, /10 \* 1024 \* 1024/);
  assert.match(data, /manual_review_required/);
  assert.match(data, /confidence:\s*100/);
});

test("AI, deterministic, and manual analysis paths are all implemented", () => {
  assert.match(workspace, /value="automatic"/);
  assert.match(workspace, /value="deterministic"/);
  assert.match(workspace, /value="manual"/);
  assert.match(analyzer, /runAiAnalysis/);
  assert.match(analyzer, /runDeterministicAnalysis/);
  assert.match(
    analyzer,
    /AI was unavailable, so deterministic analysis ran automatically/,
  );
  assert.match(analyzer, /playbook\.filter\(\(rule\) => rule\.active\)/);
  assert.match(
    workspace,
    /rules\.filter\(\(rule\) => rule\.agreementType === form\.agreementType\)/,
  );
  assert.match(aiEndpoint, /OPENAI_API_KEY/);
  assert.match(aiEndpoint, /Authenticated reviewer required/);
});

test("Supabase schema contains workflow, playbook, review, and audit tables", () => {
  for (const table of [
    "agreements",
    "findings",
    "playbook_rules",
    "audit_events",
  ]) {
    assert.match(schema, new RegExp(`create table[^;]*${table}`, "i"));
  }
  assert.match(schema, /enable row level security/i);
});

test("account profiles enforce submitter, reviewer, approver, and administrator roles", () => {
  for (const role of ["submitter", "reviewer", "approver", "administrator"]) {
    assert.ok(data.includes(role));
    assert.ok(schema.includes(role));
  }
  assert.match(app, /Account created with Submitter access/);
  assert.match(schema, /create table if not exists public\.profiles/i);
  assert.match(schema, /assign_user_role/);
  assert.match(schema, /Administrator access required/);
  assert.match(workspace, /allowedViews/);
  assert.match(workspace, /Profile & access/);
  assert.match(workspace, /Access administration/);
});

test("new hosted accounts cannot self-assign elevated access", () => {
  assert.match(schema, /role text not null default 'submitter'/i);
  assert.match(schema, /revoke update on public\.profiles from authenticated/i);
  assert.match(schema, /grant update \(full_name, updated_at\)/i);
  assert.doesNotMatch(app, /requested_role|Requested access|Request a role/);
  assert.match(data, /supabase\.rpc\("assign_user_role"/);
});

test("permissions are cumulative and approvers can resolve escalations", () => {
  assert.match(workspace, /reviewer: \["overview", "intake", "queue"/);
  assert.match(workspace, /approver: \["overview", "intake", "queue"/);
  assert.match(workspace, /Resolve escalation/);
  assert.match(workspace, /Profile settings cannot change permissions/);
});

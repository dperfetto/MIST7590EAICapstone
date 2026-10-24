#!/usr/bin/env node
// Section 6.3 independent check, Automatic (AI) path. Same 10 modified
// standard-form agreements and answer key as run_independent_check.mjs (which
// scores the deterministic path), run through the AI pipeline in ai_path.mjs.
//
// Each document is submitted as a TXT upload with its own agreement type, so
// the AI receives that type's playbook. For every edit, the edited provision is
// checked on the original and on the modified agreement against labels.json,
// and the AI's quote is compared with the text the edit removed or added.
//
// Usage (needs OPENAI_API_KEY in the environment or .env.local):
//   node --experimental-strip-types evaluation/run_independent_check_ai.mjs
//
// Writes evaluation/independent-check/ai-results/{results.json,results.csv};
// AI responses are cached in ai-results/cache/ (git-ignored).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { mapWithConcurrency } from "../src/lib/chunkText.ts";
import { ROOT, clean, model, readTextFile, runAutomaticPath } from "./ai_path.mjs";

const CHECK_DIR = path.join(ROOT, "evaluation", "independent-check");
const OUT_DIR = path.join(CHECK_DIR, "ai-results");
await mkdir(path.join(OUT_DIR, "cache"), { recursive: true });

const labels = JSON.parse(await readFile(path.join(CHECK_DIR, "labels.json"), "utf8"));
const keyword = JSON.parse(await readFile(path.join(CHECK_DIR, "results", "results.json"), "utf8"));
const keywordRow = (doc, provision) =>
  keyword.rows.find((r) => r.document === doc && r.provision === provision);

// Lines present in one version but not the other: what an edit removed or added.
const lines = (text) =>
  text.split(/\r?\n/).map(clean).filter((line) => line.length >= 20);
function editedText(original, modified) {
  const before = new Set(lines(original));
  const after = new Set(lines(modified));
  return {
    removed: [...before].filter((line) => !after.has(line)),
    added: [...after].filter((line) => !before.has(line)),
  };
}
function sharesText(quote, candidates) {
  const a = clean(quote).toLowerCase();
  return candidates.some((candidate) => {
    const b = clean(candidate).toLowerCase();
    if (a.includes(b) || b.includes(a)) return true;
    // A shared run of at least 40 characters counts as the same clause.
    for (let i = 0; i + 40 <= a.length; i += 20) if (b.includes(a.slice(i, i + 40))) return true;
    return false;
  });
}

async function analyze(doc, version) {
  const file = path.join(CHECK_DIR, version === "before" ? doc.originalFile : doc.modifiedFile);
  const text = await readTextFile(file);
  const run = await runAutomaticPath(text, doc.agreementType, path.join(OUT_DIR, "cache", `${doc.id}-${version}.json`));
  console.log(`${doc.id.padEnd(30)} ${version.padEnd(7)} ${run.methodUsed.padEnd(27)} ${run.findings.length} findings, ${run.sections} section(s)`);
  return run;
}

const runs = await mapWithConcurrency(
  labels.documents.flatMap((doc) => [
    { doc, version: "before" },
    { doc, version: "after" },
  ]),
  4,
  ({ doc, version }) => analyze(doc, version),
);
const runFor = (doc, version) =>
  runs[labels.documents.indexOf(doc) * 2 + (version === "before" ? 0 : 1)];

const rows = [];
for (const doc of labels.documents) {
  const before = runFor(doc, "before");
  const after = runFor(doc, "after");
  const edit = editedText(
    await readFile(path.join(CHECK_DIR, doc.originalFile), "utf8"),
    await readFile(path.join(CHECK_DIR, doc.modifiedFile), "utf8"),
  );
  for (const e of doc.edits) {
    const hitsBefore = before.findings.filter((f) => f.provision === e.provision);
    const hitsAfter = after.findings.filter((f) => f.provision === e.provision);
    const kw = keywordRow(doc.id, e.provision);
    rows.push({
      document: doc.id,
      agreementType: doc.agreementType,
      provision: e.provision,
      editType: e.editType,
      description: e.description,
      expectedBefore: e.expectedBefore,
      detectedBefore: hitsBefore.length > 0,
      beforeCorrect: hitsBefore.length > 0 === e.expectedBefore,
      expectedAfter: e.expectedAfter,
      detectedAfter: hitsAfter.length > 0,
      afterCorrect: hitsAfter.length > 0 === e.expectedAfter,
      // Did the "before" finding quote the clause the edit later removed or changed?
      beforeQuotesEditedText: hitsBefore.length
        ? hitsBefore.some((h) => sharesText(h.sourceText, edit.removed))
        : null,
      // Did the "after" finding quote the clause the edit added or changed?
      afterQuotesEditedText: hitsAfter.length
        ? hitsAfter.some((h) => sharesText(h.sourceText, edit.added))
        : null,
      beforeConfidence: hitsBefore.length ? Math.max(...hitsBefore.map((h) => h.confidence)) : null,
      afterConfidence: hitsAfter.length ? Math.max(...hitsAfter.map((h) => h.confidence)) : null,
      beforeQuote: hitsBefore.map((h) => h.sourceText).join("\n---\n") || null,
      afterQuote: hitsAfter.map((h) => h.sourceText).join("\n---\n") || null,
      methodBefore: before.methodUsed,
      methodAfter: after.methodUsed,
      keywordBeforeCorrect: kw?.beforeCorrect ?? null,
      keywordAfterCorrect: kw?.afterCorrect ?? null,
    });
  }
}

const totalChecks = rows.length * 2;
const correctChecks = rows.reduce((n, r) => n + r.beforeCorrect + r.afterCorrect, 0);
const keywordCorrect = rows.reduce((n, r) => n + r.keywordBeforeCorrect + r.keywordAfterCorrect, 0);
const summary = {
  description: "Section 6.3 independent check, Automatic (AI) path",
  model,
  runAt: new Date().toISOString(),
  documents: labels.documents.length,
  editInstances: rows.length,
  totalChecks,
  correctChecks,
  keywordCorrectChecks: keywordCorrect,
  aiCalls: runs.reduce((n, r) => n + r.aiCalls, 0),
  aiFallbacks: runs.filter((r) => !r.aiSucceeded).length,
  rows,
};
await writeFile(path.join(OUT_DIR, "results.json"), JSON.stringify(summary, null, 2) + "\n");
const csvHeader = [
  "document", "provision", "editType", "expectedBefore", "detectedBefore", "beforeCorrect",
  "expectedAfter", "detectedAfter", "afterCorrect", "beforeQuotesEditedText",
  "afterQuotesEditedText", "keywordBeforeCorrect", "keywordAfterCorrect",
];
await writeFile(
  path.join(OUT_DIR, "results.csv"),
  [csvHeader.join(","), ...rows.map((r) => csvHeader.map((k) => r[k] ?? "").join(","))].join("\n") + "\n",
);

console.log(`\nAI: ${correctChecks} of ${totalChecks} checks correct; keyword matching: ${keywordCorrect} of ${totalChecks}.`);
console.log(`${summary.aiCalls} AI calls, ${summary.aiFallbacks} fallback(s).\n`);
for (const r of rows)
  console.log(
    `${r.document.padEnd(30)} ${r.provision.padEnd(28)} ${r.editType.padEnd(22)} ` +
      `before ${String(r.expectedBefore).padEnd(5)}/${String(r.detectedBefore).padEnd(5)} ${r.beforeCorrect ? "ok  " : "MISS"}  ` +
      `after ${String(r.expectedAfter).padEnd(5)}/${String(r.detectedAfter).padEnd(5)} ${r.afterCorrect ? "ok  " : "MISS"}`,
  );

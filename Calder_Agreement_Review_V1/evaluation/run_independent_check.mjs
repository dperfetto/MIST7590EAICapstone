// Section 6.3 independent check.
//
// Runs Calder's actual shipped deterministic analyzer (imported directly from
// src/lib/candidateRetrieval.ts, not a reimplementation) against 10 standard-form
// agreements from Section 7.2 (Bonterms, Common Paper) and 10 deliberately modified
// versions of them. The team wrote every edit, so the correct answer is known by
// construction -- this does not rely on CUAD's labels, which is the point: it is
// an evaluation set no model or hand-tuned candidate phrase could have memorized.
//
// Usage: node --experimental-strip-types evaluation/run_independent_check.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  entriesForAgreementType,
  findCandidateClause,
} from "../src/lib/candidateRetrieval.ts";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CHECK_DIR = path.join(ROOT, "independent-check");

function detect(text, agreementType, provision) {
  const entry = entriesForAgreementType(agreementType).find(
    (candidate) => candidate.calderProvision === provision,
  );
  if (!entry) return { entryFound: false, present: false, match: null };
  const match = findCandidateClause(text, entry);
  return { entryFound: true, present: Boolean(match), match };
}

async function main() {
  const labels = JSON.parse(
    await readFile(path.join(CHECK_DIR, "labels.json"), "utf8"),
  );

  const rows = [];
  for (const doc of labels.documents) {
    const originalText = await readFile(path.join(CHECK_DIR, doc.originalFile), "utf8");
    const modifiedText = await readFile(path.join(CHECK_DIR, doc.modifiedFile), "utf8");

    for (const edit of doc.edits) {
      const before = detect(originalText, doc.agreementType, edit.provision);
      const after = detect(modifiedText, doc.agreementType, edit.provision);

      rows.push({
        document: doc.id,
        agreementType: doc.agreementType,
        provision: edit.provision,
        editType: edit.editType,
        expectedBefore: edit.expectedBefore,
        detectedBefore: before.present,
        beforeCorrect: before.present === edit.expectedBefore,
        expectedAfter: edit.expectedAfter,
        detectedAfter: after.present,
        afterCorrect: after.present === edit.expectedAfter,
        beforeConfidence: before.match?.confidence ?? null,
        afterConfidence: after.match?.confidence ?? null,
        beforeSourceText: before.match?.sourceText ?? null,
        afterSourceText: after.match?.sourceText ?? null,
      });
    }
  }

  const totalChecks = rows.length * 2;
  const correctChecks = rows.reduce(
    (sum, row) => sum + (row.beforeCorrect ? 1 : 0) + (row.afterCorrect ? 1 : 0),
    0,
  );

  const summary = {
    description: labels.description,
    documents: labels.documents.length,
    editInstances: rows.length,
    totalChecks,
    correctChecks,
    accuracy: Math.round((correctChecks / totalChecks) * 1000) / 1000,
    rows,
  };

  const outDir = path.join(CHECK_DIR, "results");
  await writeFile(
    path.join(outDir, "results.json"),
    JSON.stringify(summary, null, 2) + "\n",
    "utf8",
  );

  const csvHeader = [
    "document", "provision", "editType",
    "expectedBefore", "detectedBefore", "beforeCorrect",
    "expectedAfter", "detectedAfter", "afterCorrect",
  ];
  const csvRows = rows.map((row) => csvHeader.map((key) => row[key]).join(","));
  await writeFile(
    path.join(outDir, "results.csv"),
    [csvHeader.join(","), ...csvRows].join("\n") + "\n",
    "utf8",
  );

  console.log(`Documents: ${summary.documents}`);
  console.log(`Edit instances: ${summary.editInstances}`);
  console.log(`Checks (before + after per edit): ${summary.totalChecks}`);
  console.log(`Correct: ${summary.correctChecks}`);
  console.log(`Accuracy: ${(summary.accuracy * 100).toFixed(1)}%`);
  console.log();
  for (const row of rows) {
    const beforeMark = row.beforeCorrect ? "ok" : "MISS";
    const afterMark = row.afterCorrect ? "ok" : "MISS";
    console.log(
      `${row.document.padEnd(28)} ${row.provision.padEnd(24)} ${row.editType.padEnd(22)} ` +
      `before=${String(row.expectedBefore).padEnd(5)}/detected=${String(row.detectedBefore).padEnd(5)}[${beforeMark}]  ` +
      `after=${String(row.expectedAfter).padEnd(5)}/detected=${String(row.detectedAfter).padEnd(5)}[${afterMark}]`,
    );
  }
  console.log(`\nResults written to ${path.relative(process.cwd(), outDir)}/`);
}

main();

#!/usr/bin/env node
// Sections 6.1/6.2 check set: run Calder's Automatic (AI) path over a list of
// CUAD contracts and record what it flags, for scoring against CUAD's labels.
// The pipeline itself lives in evaluation/ai_path.mjs.
//
// Usage (needs OPENAI_API_KEY in the environment or .env.local):
//   node --experimental-strip-types evaluation/run_ai_check_set.mjs \
//     --list "/path/to/ContractsForTesting" --out evaluation/ai-check-set
//
// AI responses are cached per contract in <out>/cache, so reruns never pay
// for the same call twice. Delete the cache to re-query the model.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { mapWithConcurrency } from "../src/lib/chunkText.ts";
import { ROOT, extractPdfText, model, playbookFor, runAutomaticPath } from "./ai_path.mjs";

const AGREEMENT_TYPE = "Other"; // carries all ten provisions
const CONTRACT_CONCURRENCY = 4;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const listFile = arg("list");
const outDir = path.resolve(arg("out", path.join(ROOT, "evaluation", "ai-check-set")));
const limit = Number(arg("limit", 0));
if (!listFile) throw new Error("Pass --list <file of CUAD PDF names>.");

async function findPdf(dir, name) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findPdf(full, name);
      if (found) return found;
    } else if (entry.name === name) return full;
  }
  return null;
}

const names = (await readFile(listFile, "utf8"))
  .split(/\r?\n/)
  .map((line) => line.replace(/^\s*\d+\.\s*/, "").trim())
  .filter(Boolean)
  .slice(0, limit || undefined);
const pdfRoot = path.join(ROOT, "evaluation", "data", "CUAD_v1", "full_contract_pdf");
await mkdir(path.join(outDir, "cache"), { recursive: true });

async function runContract(name, index) {
  const contract = name.replace(/\.pdf$/i, "");
  const pdf = await findPdf(pdfRoot, name);
  if (!pdf) throw new Error(`PDF not found in CUAD corpus: ${name}`);
  const { text, pages } = await extractPdfText(pdf);
  const run = await runAutomaticPath(text, AGREEMENT_TYPE, path.join(outDir, "cache", `${contract}.json`));
  const result = { contract, pages, ...run };
  console.log(
    `[${String(index + 1).padStart(2)}/${names.length}] ${result.methodUsed.padEnd(27)} ` +
      `${String(result.findings.length).padStart(2)} findings  ${result.sections} section(s)  ${contract.slice(0, 60)}`,
  );
  return result;
}

const results = await mapWithConcurrency(names, CONTRACT_CONCURRENCY, runContract);
await writeFile(
  path.join(outDir, "results.json"),
  JSON.stringify({ model, agreementType: AGREEMENT_TYPE, provisions: playbookFor(AGREEMENT_TYPE).map((p) => p.provision), runAt: new Date().toISOString(), results }, null, 2) + "\n",
);
console.log(`\nWrote ${path.join(outDir, "results.json")}`);

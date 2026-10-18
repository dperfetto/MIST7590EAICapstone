#!/usr/bin/env node
// Sections 6.1/6.2 check set: run Calder's Automatic (AI) path over a list of
// CUAD contracts and record what it flags, for scoring against CUAD's labels.
//
// Mirrors the browser's Automatic path (src/lib/analyze.ts runAiAnalysis):
//   PDF.js text extraction -> splitTextForAi sections -> the real
//   api/analyze.js handler per section (3 at a time) -> mergeChunkFindings ->
//   drop quotes not found in the document -> confidence 90 if deterministic
//   retrieval found the same category, else 75. Any failed section falls back
//   to deterministic analysis, as the app does.
// Only the Supabase sign-in check inside api/analyze.js is stubbed.
//
// Usage (needs OPENAI_API_KEY in the environment or .env.local):
//   node --experimental-strip-types evaluation/run_ai_check_set.mjs \
//     --list "/path/to/ContractsForTesting" --out evaluation/ai-check-set
//
// AI responses are cached per contract in <out>/cache, so reruns never pay
// for the same call twice. Delete the cache to re-query the model.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  AI_MAX_CHUNKS,
  mapWithConcurrency,
  mergeChunkFindings,
  splitTextForAi,
} from "../src/lib/chunkText.ts";
import {
  entriesForAgreementType,
  findCandidateClause,
  taxonomyGuidance,
} from "../src/lib/candidateRetrieval.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGREEMENT_TYPE = "Other"; // carries all ten provisions
const AI_CONCURRENCY = 3; // same as src/lib/analyze.ts
const CONTRACT_CONCURRENCY = 4;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const listFile = arg("list");
const outDir = path.resolve(arg("out", path.join(ROOT, "evaluation", "ai-check-set")));
const limit = Number(arg("limit", 0));
if (!listFile) throw new Error("Pass --list <file of CUAD PDF names>.");

// --- environment -----------------------------------------------------------
async function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of (await readFile(file, "utf8")).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && match[1] === "OPENAI_API_KEY" && !process.env.OPENAI_API_KEY)
      process.env.OPENAI_API_KEY = match[2].replace(/^["']|["']$/g, "");
  }
}
await loadEnvLocal();
if (!process.env.OPENAI_API_KEY)
  throw new Error("OPENAI_API_KEY is not set (environment or .env.local).");
delete process.env.CUAD_CLASSIFIER_URL; // test the OpenAI extractor only
const model = process.env.OPENAI_MODEL || "gpt-5-mini";

// Stub only the Supabase sign-in check; every other request is real.
const STUB_SUPABASE = "https://calder-check-set.invalid";
process.env.SUPABASE_URL = STUB_SUPABASE;
process.env.SUPABASE_ANON_KEY = "check-set";
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.startsWith(`${STUB_SUPABASE}/auth/v1/user`))
    return Promise.resolve(new Response("{}", { status: 200 }));
  return realFetch(input, { ...init, signal: AbortSignal.timeout(300_000) });
};
const { default: analyzeHandler } = await import("../api/analyze.js");

// --- app logic mirrored from src/lib/analyze.ts ----------------------------
const clean = (value) => value.replace(/\s+/g, " ").trim();

async function extractPdfText(file) {
  const task = pdfjs.getDocument({ data: new Uint8Array(await readFile(file)), verbosity: 0 });
  const document = await task.promise;
  try {
    const pages = [];
    for (let n = 1; n <= document.numPages; n += 1) {
      const content = await (await document.getPage(n)).getTextContent();
      const pageText = content.items
        .map((item) => (item && typeof item === "object" && "str" in item ? item.str : ""))
        .join(" ");
      pages.push(`[Page ${n}] ${clean(pageText)}`);
    }
    return { text: pages.join("\n"), pages: document.numPages };
  } finally {
    await task.destroy();
  }
}

const entries = entriesForAgreementType(AGREEMENT_TYPE);
const playbook = entries.map((entry) => ({
  provision: entry.calderProvision,
  ...taxonomyGuidance(entry.calderProvision),
}));

function deterministic(text) {
  return entries
    .map((entry) => {
      const match = findCandidateClause(text, entry);
      return match
        ? { provision: entry.calderProvision, sourceText: match.sourceText, confidence: match.confidence }
        : null;
    })
    .filter(Boolean);
}

async function callAnalyze(section) {
  let statusCode = 200;
  let payload;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; },
  };
  const started = Date.now();
  await analyzeHandler(
    {
      method: "POST",
      headers: { authorization: "Bearer check-set" },
      body: { text: section, agreementType: AGREEMENT_TYPE, playbook },
    },
    res,
  );
  return { statusCode, payload, ms: Date.now() - started };
}

// --- run -------------------------------------------------------------------
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
  const cacheFile = path.join(outDir, "cache", `${name.replace(/\.pdf$/i, "")}.json`);
  const pdf = await findPdf(pdfRoot, name);
  if (!pdf) throw new Error(`PDF not found in CUAD corpus: ${name}`);
  const { text, pages } = await extractPdfText(pdf);
  const sections = splitTextForAi(text);
  const deterministicFindings = deterministic(text);

  let calls;
  if (existsSync(cacheFile)) {
    const cached = JSON.parse(await readFile(cacheFile, "utf8"));
    const cachedOk =
      cached.calls.length === sections.length &&
      cached.calls.every((c) => c && c.statusCode === 200);
    // Failed calls are retried on the next run rather than reused.
    if (cached.model === model && cached.sections === sections.length && cachedOk)
      calls = cached.calls;
  }
  if (!calls && sections.length <= AI_MAX_CHUNKS) {
    calls = [];
    try {
      // Same failure rule as the app: stop starting sections after one fails.
      await mapWithConcurrency(sections, AI_CONCURRENCY, async (section, i) => {
        const call = await callAnalyze(section);
        calls[i] = call;
        if (call.statusCode !== 200 || !Array.isArray(call.payload?.findings))
          throw new Error(`section ${i + 1}: HTTP ${call.statusCode}`);
      });
    } catch {
      // recorded in calls; handled below
    }
    await writeFile(cacheFile, JSON.stringify({ model, sections: sections.length, calls }, null, 2));
  }

  const aiOk =
    sections.length <= AI_MAX_CHUNKS &&
    calls.length === sections.length &&
    calls.every((c) => c && c.statusCode === 200 && Array.isArray(c.payload?.findings));
  const normalizedText = clean(text).toLowerCase();
  const corroborated = new Set(deterministicFindings.map((f) => f.provision));
  let aiFindings = [];
  let unverifiedQuotes = [];
  if (aiOk) {
    const merged = mergeChunkFindings(
      calls.map((c) =>
        c.payload.findings.filter(
          (f) => typeof f.provision === "string" && typeof f.sourceText === "string",
        ),
      ),
    );
    for (const f of merged) {
      const verified = f.present === true && normalizedText.includes(clean(f.sourceText).toLowerCase());
      if (verified)
        aiFindings.push({
          provision: f.provision,
          sourceText: f.sourceText,
          confidence: corroborated.has(f.provision) ? 90 : 75,
        });
      else unverifiedQuotes.push({ provision: f.provision, sourceText: f.sourceText });
    }
  }
  const result = {
    contract: name.replace(/\.pdf$/i, ""),
    pages,
    characters: text.length,
    sections: sections.length,
    aiCalls: calls?.filter(Boolean).length ?? 0,
    aiSucceeded: aiOk,
    methodUsed: aiOk ? "ai" : "deterministic (AI fallback)",
    aiError: aiOk ? null : (calls ?? []).filter((c) => c && c.statusCode !== 200).map((c) => c.payload?.error ?? `HTTP ${c.statusCode}`).join("; ") || "AI not attempted",
    aiMs: (calls ?? []).reduce((sum, c) => sum + (c?.ms ?? 0), 0),
    // What the reviewer would see: AI findings, or deterministic on fallback.
    findings: aiOk ? aiFindings : deterministicFindings.map((f) => ({ ...f })),
    unverifiedQuotes,
    deterministicFindings,
  };
  console.log(
    `[${String(index + 1).padStart(2)}/${names.length}] ${result.methodUsed.padEnd(27)} ` +
      `${String(result.findings.length).padStart(2)} findings  ${result.sections} section(s)  ${result.contract.slice(0, 60)}`,
  );
  return result;
}

const results = await mapWithConcurrency(names, CONTRACT_CONCURRENCY, runContract);
await writeFile(
  path.join(outDir, "results.json"),
  JSON.stringify({ model, agreementType: AGREEMENT_TYPE, provisions: playbook.map((p) => p.provision), runAt: new Date().toISOString(), results }, null, 2) + "\n",
);
console.log(`\nWrote ${path.join(outDir, "results.json")}`);

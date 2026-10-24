// Calder's Automatic (AI) path, run offline for evaluation scripts.
//
// Mirrors the browser's Automatic path (src/lib/analyze.ts runAiAnalysis):
//   text -> splitTextForAi sections -> the real api/analyze.js handler per
//   section (3 at a time) -> mergeChunkFindings -> drop quotes not found in the
//   document -> confidence 90 if deterministic retrieval found the same
//   category, else 75. Any failed section falls back to deterministic
//   analysis, as the app does. Only the Supabase sign-in check inside
//   api/analyze.js is stubbed.
//
// Needs OPENAI_API_KEY in the environment or .env.local. Responses are cached
// per document, so reruns never pay for the same call twice; failed calls are
// retried on the next run rather than reused.

import { readFile, writeFile, mkdir } from "node:fs/promises";
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

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AI_CONCURRENCY = 3; // same as src/lib/analyze.ts

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
export const model = process.env.OPENAI_MODEL || "gpt-5-mini";

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
export const clean = (value) => value.replace(/\s+/g, " ").trim();

export async function extractPdfText(file) {
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

// A TXT upload: the app cleans whitespace and analyzes the result.
export async function readTextFile(file) {
  return clean(await readFile(file, "utf8"));
}

export function playbookFor(agreementType) {
  return entriesForAgreementType(agreementType).map((entry) => ({
    provision: entry.calderProvision,
    ...taxonomyGuidance(entry.calderProvision),
  }));
}

function deterministic(text, agreementType) {
  return entriesForAgreementType(agreementType)
    .map((entry) => {
      const match = findCandidateClause(text, entry);
      return match
        ? { provision: entry.calderProvision, sourceText: match.sourceText, confidence: match.confidence }
        : null;
    })
    .filter(Boolean);
}

async function callAnalyze(section, agreementType, playbook) {
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
      body: { text: section, agreementType, playbook },
    },
    res,
  );
  return { statusCode, payload, ms: Date.now() - started };
}

/** Run the Automatic path on extracted text, as a reviewer would receive it. */
export async function runAutomaticPath(text, agreementType, cacheFile) {
  const playbook = playbookFor(agreementType);
  const sections = splitTextForAi(text);
  const deterministicFindings = deterministic(text, agreementType);

  let calls;
  if (existsSync(cacheFile)) {
    const cached = JSON.parse(await readFile(cacheFile, "utf8"));
    const cachedOk =
      cached.calls.length === sections.length &&
      cached.calls.every((c) => c && c.statusCode === 200);
    const sameRequest =
      cached.model === model &&
      cached.sections === sections.length &&
      (cached.agreementType ?? "Other") === agreementType;
    if (sameRequest && cachedOk) calls = cached.calls;
  }
  if (!calls && sections.length <= AI_MAX_CHUNKS) {
    calls = [];
    try {
      // Same failure rule as the app: stop starting sections after one fails.
      await mapWithConcurrency(sections, AI_CONCURRENCY, async (section, i) => {
        const call = await callAnalyze(section, agreementType, playbook);
        calls[i] = call;
        if (call.statusCode !== 200 || !Array.isArray(call.payload?.findings))
          throw new Error(`section ${i + 1}: HTTP ${call.statusCode}`);
      });
    } catch {
      // recorded in calls; handled below
    }
    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(
      cacheFile,
      JSON.stringify({ model, agreementType, sections: sections.length, calls }, null, 2),
    );
  }

  const aiOk =
    sections.length <= AI_MAX_CHUNKS &&
    calls.length === sections.length &&
    calls.every((c) => c && c.statusCode === 200 && Array.isArray(c.payload?.findings));
  const normalizedText = clean(text).toLowerCase();
  const corroborated = new Set(deterministicFindings.map((f) => f.provision));
  const aiFindings = [];
  const unverifiedQuotes = [];
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
  return {
    characters: text.length,
    sections: sections.length,
    aiCalls: calls?.filter(Boolean).length ?? 0,
    aiSucceeded: aiOk,
    methodUsed: aiOk ? "ai" : "deterministic (AI fallback)",
    aiError: aiOk
      ? null
      : (calls ?? [])
          .filter((c) => c && c.statusCode !== 200)
          .map((c) => c.payload?.error ?? `HTTP ${c.statusCode}`)
          .join("; ") || "AI not attempted",
    aiMs: (calls ?? []).reduce((sum, c) => sum + (c?.ms ?? 0), 0),
    // What the reviewer would see: AI findings, or deterministic on fallback.
    findings: aiOk ? aiFindings : deterministicFindings.map((f) => ({ ...f })),
    unverifiedQuotes,
    deterministicFindings,
  };
}

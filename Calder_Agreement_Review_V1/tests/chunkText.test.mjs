import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_CHUNK_OVERLAP,
  AI_CHUNK_SIZE,
  mapWithConcurrency,
  mergeChunkFindings,
  splitTextForAi,
} from "../src/lib/chunkText.ts";

test("short agreements are sent as a single section", () => {
  assert.deepEqual(splitTextForAi("Governing law: Georgia."), [
    "Governing law: Georgia.",
  ]);
  const exact = "x".repeat(AI_CHUNK_SIZE);
  assert.deepEqual(splitTextForAi(exact), [exact]);
});

test("long agreements are split into overlapping sections that cover all text", () => {
  const paragraph = "This Agreement shall renew automatically each year. ".repeat(40);
  const text = Array.from({ length: 120 }, (_, i) => `Section ${i}. ${paragraph}`).join("\n\n");
  assert.ok(text.length > AI_CHUNK_SIZE * 2);
  const chunks = splitTextForAi(text);
  assert.ok(chunks.length >= 3);
  for (const chunk of chunks) assert.ok(chunk.length <= AI_CHUNK_SIZE);
  // Every character is covered, and consecutive sections overlap.
  let covered = 0;
  for (const chunk of chunks) {
    const start = text.indexOf(chunk, Math.max(0, covered - AI_CHUNK_OVERLAP));
    assert.ok(start >= 0 && start <= covered, "sections must not leave gaps");
    covered = start + chunk.length;
  }
  assert.equal(covered, text.length);
  // Sections end on paragraph breaks when one is near the limit.
  for (const chunk of chunks.slice(0, -1)) assert.ok(chunk.endsWith("\n\n"));
});

test("text without breaks is still split at the hard limit", () => {
  const text = "a".repeat(AI_CHUNK_SIZE * 2 + 10);
  const chunks = splitTextForAi(text);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, AI_CHUNK_SIZE);
  assert.equal(chunks.join("").length, text.length + AI_CHUNK_OVERLAP * 2);
});

test("a clause on a section boundary appears whole in one section", () => {
  const clause = "Either party may terminate this Agreement for convenience on thirty days notice.";
  const filler = "z".repeat(AI_CHUNK_SIZE - 40);
  const text = `${filler}${clause}${"y".repeat(5000)}`;
  const chunks = splitTextForAi(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.some((chunk) => chunk.includes(clause)));
});

test("findings repeated across overlapping sections are merged", () => {
  const merged = mergeChunkFindings([
    [
      { provision: "Governing Law", sourceText: "governed by the laws of Georgia" },
      { provision: "Audit Rights", sourceText: "may audit the books" },
    ],
    [
      { provision: "Governing Law", sourceText: "Governed by the  laws of Georgia" },
      { provision: "Governing Law", sourceText: "venue shall be Atlanta" },
    ],
  ]);
  assert.deepEqual(
    merged.map((f) => `${f.provision}: ${f.sourceText}`),
    [
      "Governing Law: governed by the laws of Georgia",
      "Audit Rights: may audit the books",
      "Governing Law: venue shall be Atlanta",
    ],
  );
});

test("sections are analyzed with bounded concurrency and results keep their order", async () => {
  let inFlight = 0;
  let peak = 0;
  const results = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (ms, i) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, ms));
    inFlight -= 1;
    return i;
  });
  assert.deepEqual(results, [0, 1, 2, 3, 4]);
  assert.equal(peak, 2);
});

test("no further sections are sent after one fails", async () => {
  const started = [];
  await assert.rejects(
    mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async (i) => {
      started.push(i);
      await new Promise((resolve) => setTimeout(resolve, i === 1 ? 1 : 20));
      if (i === 1) throw new Error("AI analysis is unavailable.");
      return i;
    }),
    /unavailable/,
  );
  // Let the sections already in flight settle before counting.
  await new Promise((resolve) => setTimeout(resolve, 100));
  // Sections 0-2 were in flight when section 1 failed; nothing else started.
  assert.deepEqual(started, [0, 1, 2]);
});

test("a failed section fails the whole AI run", async () => {
  await assert.rejects(
    mapWithConcurrency([1, 2, 3], 3, async (n) => {
      if (n === 2) throw new Error("AI analysis is unavailable.");
      return n;
    }),
    /unavailable/,
  );
});

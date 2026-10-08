// Long agreements are sent to the hosted extractor in sections so the model
// sees the whole contract, not just its opening pages. Sections overlap so a
// provision that straddles a boundary still appears whole in one of them.
// Kept dependency-free so tests can import it directly.

export const AI_CHUNK_SIZE = 120_000;
export const AI_CHUNK_OVERLAP = 2_000;
// About 1.4 million characters (roughly 900 pages). Longer text is not sent
// to the hosted extractor; the caller falls back to deterministic analysis.
export const AI_MAX_CHUNKS = 12;

// Prefer to end a section at a paragraph break, then a sentence end, within
// the last 10% of the window, so clauses are not cut mid-sentence.
function sectionEnd(text: string, start: number, size: number) {
  const hardEnd = start + size;
  if (hardEnd >= text.length) return text.length;
  const window = text.slice(start, hardEnd);
  const floor = Math.floor(size * 0.9);
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph >= floor) return start + paragraph + 2;
  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf(".\n"),
    window.lastIndexOf("; "),
  );
  if (sentence >= floor) return start + sentence + 2;
  return hardEnd;
}

export function splitTextForAi(
  text: string,
  size = AI_CHUNK_SIZE,
  overlap = AI_CHUNK_OVERLAP,
) {
  if (overlap >= size) throw new Error("Chunk overlap must be smaller than the chunk size.");
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  let start = 0;
  for (;;) {
    const end = sectionEnd(text, start, size);
    chunks.push(text.slice(start, end));
    if (end >= text.length) return chunks;
    start = end - overlap;
  }
}

type SpanFinding = { provision: string; sourceText: string };

// Overlapping sections can return the same span twice; keep the first.
export function mergeChunkFindings<T extends SpanFinding>(results: T[][]) {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const finding of results.flat()) {
    const key = `${finding.provision}\u0000${finding.sourceText.replace(/\s+/g, " ").trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(finding);
  }
  return merged;
}

// Run `task` over every item with at most `limit` in flight, preserving order.
// Rejects as soon as any task fails, and starts no further tasks after that,
// so a failed AI run doesn't keep paying for sections whose results are
// discarded. Tasks already in flight are left to finish.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await task(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

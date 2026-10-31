import assert from "node:assert/strict";
import test from "node:test";
import { BATCH_SIZE, readInBatches } from "../src/lib/batches.ts";

// A fake table that returns at most `cap` rows per request, like Supabase's max_rows.
const table = (size, cap, { count = true } = {}) => {
  const rows = Array.from({ length: size }, (_, i) => ({ id: i }));
  const calls = [];
  const fetchRange = async (from, to) => {
    calls.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + cap)), count: count ? size : null, error: null };
  };
  return { fetchRange, calls };
};

test("reads past the 1,000-row cap", async () => {
  const { fetchRange, calls } = table(2500, BATCH_SIZE);
  const rows = await readInBatches(fetchRange);
  assert.equal(rows.length, 2500);
  assert.deepEqual(rows.map((r) => r.id), [...Array(2500).keys()]);
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("still reads everything when the server caps batches lower than requested", async () => {
  const { fetchRange, calls } = table(1200, 500);
  const rows = await readInBatches(fetchRange);
  assert.equal(rows.length, 1200);
  assert.equal(new Set(rows.map((r) => r.id)).size, 1200);
  assert.equal(calls.length, 3);
});

test("stops after one request for a small or empty table", async () => {
  for (const size of [0, 1, 999]) {
    const { fetchRange, calls } = table(size, BATCH_SIZE);
    assert.equal((await readInBatches(fetchRange)).length, size);
    assert.equal(calls.length, 1);
  }
});

test("without a count, a short batch ends the read", async () => {
  const { fetchRange } = table(1500, BATCH_SIZE, { count: false });
  assert.equal((await readInBatches(fetchRange)).length, 1500);
});

test("an error is thrown, not returned as a partial list", async () => {
  let call = 0;
  const failing = async () => (++call === 2 ? { data: null, count: null, error: new Error("timeout") } : { data: Array(BATCH_SIZE).fill({}), count: 3000, error: null });
  await assert.rejects(readInBatches(failing), /timeout/);
});

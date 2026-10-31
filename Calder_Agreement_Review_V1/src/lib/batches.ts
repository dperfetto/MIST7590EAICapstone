// Supabase returns at most 1,000 rows per request by default (and a project
// can set a lower cap), silently dropping the rest. readInBatches keeps asking
// for the next range until the total reported by the server has arrived, so a
// smaller cap still loads everything. Kept free of app imports so tests can
// load it directly.

export const BATCH_SIZE = 1000;

type Page<T> = { data: T[] | null; count: number | null; error: unknown };

export async function readInBatches<T>(fetchRange: (from: number, to: number) => PromiseLike<Page<T>>) {
  const rows: T[] = [];
  let total = Infinity;
  while (rows.length < total) {
    const page = await fetchRange(rows.length, rows.length + BATCH_SIZE - 1);
    if (page.error) throw page.error;
    const data = page.data ?? [];
    // Without a count, a short batch means the table is done.
    total = page.count ?? (data.length < BATCH_SIZE ? rows.length + data.length : Infinity);
    if (!data.length) break;
    rows.push(...data);
  }
  return rows;
}

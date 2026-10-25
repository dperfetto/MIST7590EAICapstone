// Comment threads on findings, between the Requester who submitted the
// agreement and the review team. Comments are durable: they can be added but
// not edited or deleted, like the rest of the audit record.

export const MAX_COMMENT_LENGTH = 2000;

export type FindingComment = {
  id: string;
  findingId: string;
  agreementId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
};

/** The trimmed comment text, or an error message if it can't be posted. */
export function validateComment(body: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const text = String(body ?? "").trim();
  if (!text) return { ok: false, error: "Write a comment before posting." };
  if (text.length > MAX_COMMENT_LENGTH)
    return { ok: false, error: `Comments can be up to ${MAX_COMMENT_LENGTH} characters.` };
  return { ok: true, body: text };
}

/** Short form for the audit log. */
export const commentPreview = (body: string, length = 120) =>
  body.length > length ? `${body.slice(0, length - 1).trimEnd()}…` : body;

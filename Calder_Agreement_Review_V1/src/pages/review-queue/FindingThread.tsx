import { type Finding, type FindingComment } from "@/workspace/types";
import { useState } from "react";
import { MAX_COMMENT_LENGTH } from "@/lib/comments";
import { roleLabels, type UserRole } from "@/lib/model";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Discussion on one finding between the Requester and the review team. */
export function FindingThread({
  finding,
  comments,
  submit,
}: {
  finding: Finding;
  comments: FindingComment[];
  submit: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(comments.length > 0),
    [draft, setDraft] = useState(""),
    [posting, setPosting] = useState(false);
  const post = async () => {
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      if (await submit({ action: "add_comment", findingId: finding.id, body: draft.trim() })) setDraft("");
    } finally {
      setPosting(false);
    }
  };
  const id = `thread-${finding.id}`;
  return (
    <div className="finding-thread">
      <button type="button" className="finding-thread-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <MessageSquare size={15} aria-hidden="true" />
        {comments.length ? `Discussion (${comments.length})` : "Start a discussion"}
      </button>
      {open && (
        <div id={id} className="finding-thread-body">
          {comments.length > 0 && (
            <ol>
              {comments.map((c) => (
                <li key={c.id} className={c.authorRole === "submitter" ? "from-requester" : "from-review-team"}>
                  <div>
                    <strong>{c.authorName}</strong>
                    <span>
                      {c.authorRole === "submitter" ? "Requester" : roleLabels[c.authorRole as UserRole] ?? c.authorRole} · {when(c.createdAt)}
                    </span>
                  </div>
                  <p>{c.body}</p>
                </li>
              ))}
            </ol>
          )}
          <Textarea
            value={draft}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Comment on ${finding.provision}…`}
            aria-label={`Comment on ${finding.provision}`}
          />
          <div className="finding-thread-actions">
            <span>Comments are added to the audit record and cannot be edited.</span>
            <Button size="sm" variant="outline" onClick={() => void post()} disabled={!draft.trim() || posting}>
              Post comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

# Confidence threshold note

Required by Section 6.4 of the project brief. Four questions, answered against the numbers
Calder has actually measured rather than asserted.

## 1. Where is the threshold set, and why?

**85.** A finding with confidence below 85 is marked low-confidence in the UI (red risk line,
counted in the "verify confidence" metric) — see `src/Workspace.tsx:405,508,906,952`. This is not
a round number chosen by feel; it falls out of how Calder's two analysis paths actually score
evidence:

- **Hosted findings** only ever take one of two values (`src/lib/analyze.ts:193-201`): 75 if the
  returned source span is verified against the document text but not independently corroborated,
  or 90 if deterministic retrieval independently agrees on the same category. 85 sits exactly
  between these two tiers, so the threshold operationalizes a real qualitative fact — was this
  finding corroborated by a second, independent method, or not — rather than a tuned cutoff on a
  continuous score.
- **Deterministic findings** get a continuous score (`src/lib/candidateRetrieval.ts:52`):
  `60 + 9 × (number of matched candidate phrases) + 4 (if the matched clause is over 100 characters)`,
  capped at 96. At 85, a deterministic finding needs roughly **three independent phrase cues** to
  clear the bar on its own — one or two cues (69–82 with the length bonus) do not. That matches
  the intuition that a single keyword match is weaker evidence than several independent cues
  agreeing.

Critically, the threshold **never suppresses a finding**. Every finding the analyzer produces,
regardless of confidence, enters the review queue and requires a human disposition — confidence
only changes how urgently it's flagged, never whether it's shown. This was a deliberate choice: see
Question 2.

## 2. Which is worse — a wasted-time flag, or silence on a real problem?

Silence is worse, and the client said so directly in Section 1: *"If it misses something real,
people stop trusting it, and then we are worse off than before we had it. Nobody double-checks a
tool they think is reliable."* A false flag costs a reviewer a few minutes reading a clause that
turns out fine. A false silence costs nothing visible at submission — and everything later, which
is exactly the client's own incident: an auto-renewal notice window missed and caught eleven days
too late.

This is why the confidence threshold is a *triage* mechanism, not a *gating* mechanism. Raising or
lowering 85 only changes which already-surfaced findings get a visual priority flag; it has **no
effect on silent misses**, because a clause the analyzer never matched never produces a finding
for the threshold to score in the first place. The lever that actually controls silence is the
analyzer's recall, not this threshold — see Question 3.

## 3. What does the threshold mean in practice? Roughly how much does the system miss?

Two different numbers answer two different questions, and the gap between them is the point.

**Of findings the system does generate, how many get flagged for extra scrutiny?** In the Section
6.3 independent-check sample (12 deliberately edited clauses, `evaluation/independent-check/`),
the deterministic analyzer produced 15 matches across the before/after pairs. **14 of 15 (93%)
scored below 85** — 10 matches at 73 (one phrase cue), 4 at 82 (two cues), and only 1 at 91 (three
cues). On real standard-form contract language, most deterministic matches are thin single- or
double-cue hits, so in practice the great majority of what the deterministic path finds gets the
low-confidence flag today. That is a small sample (12 documents) and should be re-measured against
the full 510-contract CUAD corpus once the dataset is downloaded locally — `evaluation/data/` is
gitignored and not present in every environment — but it is real, measured data, not a projection.

**How much does the system miss entirely — find nothing at all?** This is recall, from the
committed CUAD evaluation (`evaluation/results/metrics.csv`, 510 contracts): **micro recall is
73.8%** across the 10 active categories (1,618 of 2,193 expert-labeled positive instances found).
That means roughly **one in four** provisions the playbook is looking for, and that is actually
present in a submitted agreement, never generates a finding at all — not a low-confidence finding,
no finding. This is uneven across categories, not a flat 26%:

| Category | Recall | Miss rate |
|---|---|---|
| Governing Law | 99.8% | 0.2% |
| Assignment / Control | 97.3% | 2.7% |
| Exclusivity | 97.8% | 2.2% |
| Termination for Convenience | 70.0% | 30.0% |
| Insurance | 67.5% | 32.5% |
| Auto Renewal | 61.9% | 38.1% |
| Cap on Liability | 54.6% | 45.5% |
| Warranty Duration | 38.7% | 61.3% |
| Renewal Notice | 39.6% | 60.4% |
| **Audit Rights** | **31.8%** | **68.2%** |

The Section 6.3 independent check corroborates this is not a CUAD-specific artifact: of 12
deliberately edited clauses in hand-picked, well-formatted standard-form agreements, the Bonterms
Cloud Terms liability cap and renewal-notice clauses were never detected at all, before or after
editing, because Bonterms drafts them as defined terms ("General Cap") rather than with Calder's
candidate phrases (`evaluation/independent-check/RESULTS.md`).

**Confidence is not the thing to point to when asked "how much does this miss."** It describes the
reliability of what was found. Recall describes what wasn't found. Calder's threshold cannot
improve recall; only better candidate phrases, hosted extraction, or manual fallback can.

## 4. What would you tell the Associate General Counsel?

Directly: **rely on it for triage, not for completeness.** Every finding requires your or a
reviewer's sign-off regardless of its confidence score — the system never auto-clears anything, so
a high-confidence finding is not a finding you can skip. What the confidence score cannot tell you
is what never made it into the queue. On the categories currently in scope, roughly one in four
present provisions generates no finding at all, concentrated heavily in Audit Rights, Renewal
Notice, Warranty Duration, and Cap on Liability — if a DPA has a real audit-rights problem, this
system is worse than a coin flip at surfacing it on its own. Governing Law, Assignment/Control, and
Exclusivity are the strongest categories and close to complete.

So: use Calder to find the forty of two hundred that clearly need you, fast. Don't use it to
conclude that the other hundred and sixty are clean — nothing in this system's design claims that,
and this note exists so nobody mistakes "no flag" for "no problem." If your real exposure is
concentrated in a category this table shows is weak, a sampling-based manual spot-check of
agreements that cleared without that flag is still warranted until recall improves there.

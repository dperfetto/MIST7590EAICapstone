# Section 6.3 independent check

## Why this exists

CUAD is a well-known public dataset. A hosted language model may have seen it during
training, and even our own deterministic candidate phrases were tuned by reading CUAD's
Labeling Handbook and example spans — so a strong score on CUAD (`evaluation/results/metrics.csv`)
does not by itself prove the system generalizes. This check uses documents and edits that
cannot have leaked into anything: we wrote the edits ourselves, days before running them.

## Method

1. Took 10 standard-form agreements from Section 7.2 — 5 from Bonterms, 5 from Common
   Paper, pulled as plaintext/Markdown from each publisher's GitHub repository (both CC BY 4.0;
   see `LICENSES/` for attribution). Originals are in `originals/`.
2. Made one or two deliberate, hand-written edits to each, covering the brief's four example
   edit types — remove a protection, change a liability cap, shorten a notice period, insert an
   unusual clause — and touching all 10 of Calder's active playbook categories at least once.
   Modified documents are in `modified/`; the exact edit and the expected answer for every
   instance is recorded in `labels.json`, written before the check was run.
3. Ran Calder's actual shipped deterministic analyzer — `entriesForAgreementType` and
   `findCandidateClause` imported directly from `src/lib/candidateRetrieval.ts`, not a
   reimplementation — against the original and modified text of every document, via
   `evaluation/run_independent_check.mjs`:

   ```bash
   node --experimental-strip-types evaluation/run_independent_check.mjs
   ```

4. Compared the detector's before/after output to the known answer. Raw output is in
   `results/results.json` and `results/results.csv`.

This check deliberately does not touch the hosted AI extractor. The hosted path already runs
behind source-span verification and deterministic corroboration (see `docs/DECISION_AND_AMBIGUITY_LOG.md`),
and Section 6.3's purpose — a check set nothing could have memorized — matters most for the
component that was tuned by hand against public material.

## Results

**16 of 24 checks correct (66.7%)** — 12 edit instances, each checked before and after the edit.

| Document | Provision | Edit type | Before: expected/detected | After: expected/detected | Result |
|---|---|---|---|---|---|
| bonterms-cloud-terms | Cap on Liability | change liability cap | true / **false** | true / **false** | miss (both) |
| bonterms-cloud-terms | Renewal Notice | shorten notice period | true / **false** | true / **false** | miss (both) |
| commonpaper-csa | Auto Renewal | remove protection | true / true | false / false | holds |
| commonpaper-software-license | Exclusivity | insert unusual clause | false / **true** | true / true | miss (before) |
| bonterms-mutual-nda | Governing Law | remove protection | true / true | false / false | holds |
| bonterms-sla | Cap on Liability | insert unusual clause | false / false | true / true | holds |
| bonterms-psa | Termination for Convenience | remove protection | true / true | false / **true** | miss (after) |
| commonpaper-psa | Insurance | remove protection | true / true | false / false | holds |
| commonpaper-psa | Warranty Duration | insert unusual clause | false / false | true / true | holds |
| commonpaper-mutual-nda | Assignment / Control | insert unusual clause | true / true | true / true | holds |
| bonterms-dpa | Audit Rights | remove protection | true / true | false / **true** | miss (after) |
| commonpaper-dpa | Audit Rights | remove protection | true / true | false / **true** | miss (after) |

Performance does **not** hold uniformly. It holds cleanly for 6 of 12 edits (CSA auto-renewal,
NDA governing-law removal, the SLA liability-cap insertion, PSA insurance removal, PSA warranty
insertion, and — notably — the brief's own named example, the unusual assignment clause). The
other 6 fail in three distinct, explainable ways, not randomly:

### 1. Defined-term drafting is invisible to phrase matching (2 misses)

Bonterms drafts its liability cap and renewal term as defined terms ("General Cap," "Subscription
Term") rather than using the literal words "liability cap" or "notice of non-renewal." Our
candidate phrases, tuned against CUAD's SEC-filing drafting style, never fire on this document —
**in either the original or the edited version.** The companion case in `bonterms-sla` proves this
is a drafting-style problem, not a provision problem: we inserted a liability cap into the SLA
using plain language ("Provider's aggregate liability ... will not exceed") and it was found
immediately. Same provision, same publisher family, different phrasing, opposite result.

**Consequence:** the deterministic layer has a real blind spot on modular, defined-term contract
drafting (Bonterms and Common Paper are both built this way deliberately — see Section 7.2's note
that Common Paper is "drafted by an attorney committee"). This is worth knowing before telling
anyone the system reads Bonterms- or Common Paper-style agreements reliably.

### 2. Removing a protection does not reliably clear the finding (3 misses)

This is the pattern Change Notice 1 warned about for gap detection, and it shows up even at the
presence layer:

- **bonterms-psa / Termination for Convenience:** after deleting the actual clause, the matcher
  instead latched onto an unrelated IP-assignment clause 15 pages later containing the incidental
  phrase "for any reason" — one of this category's candidate phrases, present in a sentence about
  nothing to do with termination.
- **bonterms-dpa / Audit Rights:** the retained sentence "any audit rights granted by Data
  Protection Laws will be satisfied by the Audit Reports" still contains the literal phrase "audit
  rights," even though it refers to rights granted by statute, not by Provider, and no
  customer-initiated audit mechanism remains anywhere in the document.
- **commonpaper-dpa / Audit Rights:** we replaced the audit clause with one that explicitly
  *prohibits* customer audits — and the prohibition sentence itself ("will not conduct ... a
  third-party audit of Provider's facilities") contains the phrase "audit of." The matcher has no
  negation handling, so a sentence banning an audit right reads the same as one granting it.

**Consequence:** this is exactly why gap detection is disabled (per Change Notice 1 and
`docs/STRETCH_BACKLOG.md`) rather than merely deferred as a nice-to-have. A real redline that
deletes a protection can leave the deterministic layer still reporting it present, for reasons
that have nothing to do with extraction failure — the category's own candidate phrases are too
generic. Any future gap-detection work should treat "no longer finds X" as meaningfully weaker
evidence than these results would suggest, because the converse failure (still finds X after
removal) is already common.

### 3. One category's own documented exclusion isn't enforced (1 miss)

`commonpaper-software-license`'s **unmodified** original was flagged present for Exclusivity before
we touched it, purely because of its ordinary "non-exclusive ... license" grant — the exact case
the taxonomy's own `exclusions` field warns against (`src/data/cuad-calder-taxonomy.json`:
"Do not label ... an intellectual-property license merely because it uses the word exclusive").
The deterministic matcher has no mechanism to apply that exclusion; it only does substring
matching. This corroborates, with a concrete example, the already-known weak spot in the CUAD
evaluation: Exclusivity has the worst precision of any category there (0.44, `evaluation/results/metrics.csv`,
228 false positives against 176 true positives). This check shows exactly what one of those false
positives looks like in a real document.

### What held up

The brief's own named example — "insert an unusual assignment clause" — worked correctly
(`commonpaper-mutual-nda`): replacing a standard consent-based assignment clause with one allowing
free assignment to a competitor was still detected as present, because the matcher only needs the
word "assignment" to appear, regardless of how unusual the substance is. Three straightforward
removals (CSA auto-renewal, NDA governing law, PSA insurance) and one clean insertion (PSA warranty
duration) also behaved exactly as expected.

## Answering the brief's question

Section 6.3 asks: does performance hold against documents nothing could have memorized? **Partially,
and not uniformly.** 50% of the individual edits (6/12) behaved exactly as expected both before and
after; the failures cluster into three specific, well-understood causes above rather than being
unpredictable noise. That is itself useful: a system that fails unpredictably is hard to reason
about, while a system whose failure modes are this legible can be scoped around (e.g., flag modular/
defined-term agreements for manual review by default, or tighten the Exclusivity and "for any
reason"-style candidate phrases).

## Attribution

Source documents are CC BY 4.0: Bonterms (bonterms.com, github.com/Bonterms) and Common Paper
(commonpaper.com, github.com/CommonPaper). See `LICENSES/` for the attribution notice. All 10
modified documents in `modified/` are team-authored derivative edits of these CC BY 4.0 originals.

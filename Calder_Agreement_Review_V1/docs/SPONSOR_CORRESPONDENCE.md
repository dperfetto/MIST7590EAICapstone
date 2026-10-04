# Sponsor correspondence

Primary-source record of sponsor communications that changed the required scope. Kept verbatim so the change log's summary can be checked against the original.

## Change Notice 1 — Amendment to Project Brief v1, Sections 2, 4, 5, and 8

- **From:** Nikhil Srinivasan <nsrini@uga.view.usg.edu>
- **To:** All project teams
- **Date:** Wed 9/9/2026, 1:11 PM
- **Subject:** MIST7590E AI Technology Capstone Project Fall 2026 28079: Amendment to Project Brief v1, Sections 2, 4, 5, and 8
- **Channel:** eLearning Commons (eLC) course announcement/email

> ### MIST 7590E — Change Notice 1
> ### Vendor Agreement Review Assistant
>
> **To:** All project teams
> **Re:** Amendment to Project Brief v1, Sections 2, 4, 5, and 8
>
> **What changed**
>
> One of the teams asked where Calder's documented standard positions come from. The brief does not answer that, and the requirement I wrote depends on having them.
>
> Here is what v1 asked you to do without saying so. Read the Bonterms and Common Paper agreements. Work out what an acceptable version of each provision looks like. Build a table of those standard positions with rules for what counts as a departure. Then have your system compare each contract against that table.
>
> That is a large piece of domain work sitting in front of your application build. I did not write it down and I did not account for it in the scope. This is my error.
>
> **I am cutting it.**
>
> **The new required scope**
>
> Your system identifies whether a provision is present. Nothing more.
>
> For each contract, for each category in your playbook, the system answers one question: is this provision in here? If yes, it returns the supporting text and a confidence indicator, and a reviewer decides what to do about it.
>
> That is the baseline. It is what I grade against.
>
> **What moved to stretch**
>
> Standard positions and deviation characterization. Recording what Calder considers acceptable, and describing how a given contract departs from it. A liability cap that exists but sits at three months of fees rather than twelve is a deviation rather than simply a presence.
>
> Gap detection. Flagging provisions your playbook expects but the agreement omits.
>
> Gap detection is worth a word of warning if you are considering it. Your system cannot easily tell the difference between a provision that is genuinely absent and one your segmenter missed. Every miss in identification turns into a confident false gap, and false gaps are the failure mode the client warned you about in Section 1.
>
> A team that reaches either of these has done well. Neither is required and neither is expected.
>
> **Other edits that follow from this**
>
> Section 2 - The success outcome reading "which terms the company most often accepts against its own standard" is replaced with: "which provisions come up most often across submitted agreements." That is a count over your flag table.
>
> Section 4 - Stages 4 and 5, comparison to standard position and gap detection, are removed from the required workflow. The workflow is now intake, ingestion and segmentation, identification, flag generation, review, disposition, record, reporting.
>
> Section 5 - The AI component identifies presence, returns a source span, and returns a confidence indicator. It does not extract values or characterize deviations.
>
> Section 7.2 stays - You still need the Bonterms and Common Paper documents for the independent check in Section 6.3, where you modify standard-form agreements to build an evaluation set the models have never seen.
>
> **What I want you to do with this**
>
> Log it as a change - This is a sponsor-initiated scope change and it belongs in your change log with the rest of them.
>
> NOTE: If you have already built part of the positions table, keep it. Do not throw the work away. Put it in your stretch backlog and say in your documentation that you scoped it out deliberately. Work you chose not to ship, with a reason, is a better artifact than work you never started.
>
> Reallocate the time to the application - That is the point of the change.
>
> Related guidance: build the application before the model. This is not part of the amendment. It is advice.
>
> Most of you will want to start with the AI component. Start with the application instead. Build the whole thing first with a person doing the identification. Intake, segmentation, a screen where a team member marks which provisions a contract contains and pastes the supporting text, flag generation, the review queue, disposition, the audit record, reporting, roles, deployed at a URL. No AI in it anywhere. It is the application with one step done by hand. Then replace the person.
>
> Four reasons for this:
>
> - You have a working system, and everything after that makes it better.
> - The interface your model has to satisfy gets discovered rather than guessed. Whatever fields the manual screen collects are the fields the model must return.
> - You find out that submission and analysis cannot live in the same request.
> - If the model work goes badly you still have a working system and an honest account of what happened. That is a much better position in December than a half-finished pipeline.
>
> Keep the manual path after the model works. It is your answer when I ask what happens if the AI service goes down.
>
> **Questions you are likely to ask**
>
> Does this mean less work? - Less domain work. The application is unchanged and the evaluation requirements in Section 6 are unchanged. What you have lost is a table you would have hand-built before writing much code.
>
> Can we still do the deviation work? - Yes, once the baseline is complete and deployed. Not before.
>
> Are we penalized for not attempting stretch? - No. A complete, working, deployed baseline scores well. A partial ambitious build does not.
>
> Does this change the number of categories? - No. Eight to twelve, selected and justified. Two things drive the choice. Does Calder's stated problem touch it, and are there enough labeled examples in the corpus to measure anything. Count the positives per category before you commit.
>
> Does this change Section 6? - No. With presence identification the numbers are cleaner to compute, which is a benefit.
>
> Questions are good. This notice is based on questions I received last week and it improved the brief, and I would rather find the gaps now.

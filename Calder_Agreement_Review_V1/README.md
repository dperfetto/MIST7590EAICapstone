# Calder Agreement Review - Portable Edition v1.6.4

Calder is a React/Vite vendor-agreement workflow that identifies whether selected provisions are present, shows supporting source text and confidence, and routes every result to a human reviewer. It runs locally, deploys to Vercel, and optionally uses Supabase for authentication, persistence, row-level security, and private document storage.

Version 1.6.4 implements the sponsor's presence-only scope amendment, CUAD taxonomy mapping and evaluation, resilient review screens, in-product detection-method guidance, and Safari-compatible browser-only searchable-PDF ingestion with PDF.js.

## Required baseline

For each active category in the Requester-declared contract-type playbook, Calder answers one question: **is this provision present?** Positive findings contain the category, exact source text, confidence indicator, and analysis method. A reviewer accepts, dismisses, or escalates the finding with a reason.

The baseline does not extract values, compare legal standards, characterize deviations, assign risk severity, or create gaps from categories not found. Earlier standard-position work is preserved as disabled stretch metadata in `docs/STRETCH_BACKLOG.md`.

## Analysis and fallback order

1. PDF.js extracts searchable PDF text in the browser.
2. An optional general-purpose hosted presence extractor can use CUAD definitions and exclusions.
3. An optional isolated CUAD-trained classifier experiment remains disabled by default.
4. CUAD-informed deterministic candidate retrieval runs without AI.
5. Guided manual identification remains available.

The recommended hosted path is a general-purpose model with a strict presence/source schema. Its self-reported confidence is ignored: Calder verifies that the source span occurs in the document and checks whether deterministic retrieval independently agrees. An optional separate CUAD-trained classifier service is included only as an isolated experiment and is off by default; do not use CUAD contracts seen during training to report its evaluation metrics.

The playbook selects categories. Hosted extractors never receive Calder's draft risk standards. If risk decisions are enabled later as stretch work, only Calder's versioned playbook engine may make them.

## Agreement types

The Requester selects one of Calder's procurement intake values; the application never infers it:

- Software Subscription
- Professional Services
- Licensing
- Logistics and Freight
- Data Processing Addendum
- Mutual NDA
- Other

## Accounts and role-based access

- **Submitter**: submit agreements and track outcomes.
- **Reviewer**: Submitter access plus the review queue, manual findings, and accept, dismiss, or escalate actions.
- **Approver**: Reviewer access plus the ability to resolve escalated items.
- **Administrator**: manage active playbook categories, roles, reporting, and audit history.

Every new account starts as a Submitter. Only an Administrator can assign elevated roles. Supabase Auth hashes passwords and issues expiring sessions; database row-level security and stored functions enforce authorization on the server. Hiding navigation is only a usability layer, not the security boundary.

## Run locally

Prerequisites: Node.js 22 and npm. From the repository root:

```bash
cd Calder_Agreement_Review_V1
npm install
npm run check   # optional: lint, tests, and production build
```

The app chooses its mode at startup from two environment variables:

| Mode | When it is used | Login | Where data lives |
| --- | --- | --- | --- |
| **Demo** | `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing or empty | No real accounts | Seeded sample data in your browser's localStorage |
| **Supabase** | Both variables are set (normally in `.env.local`) | Supabase Auth accounts | Your Supabase database and private storage |

### Option A: Demo mode (no setup)

Use this to try the app quickly. Nothing leaves your browser.

If there is **no** `.env.local` file:

```bash
npm run dev
```

If you **already have** a `.env.local` with Supabase keys, blank them out for this run (the file is not changed):

```bash
VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npm run dev
```

Open `http://localhost:5173`. Demo data is saved in browser localStorage, so it survives a page reload. To reset it, clear the site data for `localhost:5173` in your browser's developer tools.

### Option B: Connected to Supabase

Use this to test real sign-up/sign-in, role-based access, row-level security, and shared data.

1. Create a Supabase project.
2. In **SQL Editor**, run the complete `supabase/schema.sql`. Existing v1.5 deployments must rerun it to migrate shorthand agreement types and allow the new `present` finding type while retaining historical findings.
3. Keep Email authentication enabled. Email verification, password reset, MFA, and account lockout are not required by the project.
4. In **Project Settings → API**, copy the Project URL and the publishable (anon) key.
5. Create `Calder_Agreement_Review_V1/.env.local` containing:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   ```

6. Start the app (restart it if it was already running, since Vite reads `.env.local` only at startup):

   ```bash
   npm run dev
   ```

7. Open `http://localhost:5173` and create an account. Every new account starts as a Submitter. To test the other roles, make your first account an Administrator by running this once in **SQL Editor**, then assign roles to other accounts from inside the app:

   ```sql
   update public.profiles set role = 'administrator'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

Never put a Supabase secret/service-role key in this frontend project. `.env.local` is for your machine only; do not commit it.

### Test the fallback paths

These steps work in either mode:

1. Open **New intake**, choose an agreement type, and upload a searchable PDF/TXT.
2. Choose **Deterministic only** and confirm source-linked presence findings are created.
3. Choose **Manual review only**, then use **Add manual finding** in the reviewer queue.
4. Choose **Automatic** with no hosted keys and confirm deterministic analysis runs automatically.
5. Upload an image-only PDF and confirm intake rejects it before storage with a clear message.

TXT remains available for corpus testing; searchable PDF is the required project format. DOCX and OCR are outside the required scope.

To verify a representative file before testing it in the UI:

```bash
npm run verify:ingestion -- "/absolute/path/to/Contract 1.pdf"
npm run verify:ingestion -- "/absolute/path/to/contract.txt"
```

The command reports file size, page count for PDFs, searchable character count,
an extraction preview, and an accepted/rejected decision. The supplied
`Contract 1.pdf` was verified at 146 pages and 225,021 searchable characters.

## Deploy on the zero-dollar stack

1. Push exactly one application folder named `Calder_Agreement_Review_V1` to GitHub.
2. Import the repository into Vercel.
3. If the repository contains the app as a subfolder, set **Root Directory** to `Calder_Agreement_Review_V1`; otherwise leave it blank.
4. Use Framework **Vite**, Build Command `npm run build`, and Output Directory `dist`.
5. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`.
6. Optionally add `OPENAI_API_KEY` and `OPENAI_MODEL`.
7. Deploy and compare observed analysis time in the audit log with the limits of the selected free tier before committing to a hosted model architecture.

The optional Python classifier cannot run on Vercel's static frontend and should be placed on a separate free service only after its cold-start and contract-analysis duration are measured. See `classifier-service/README.md`.

## Run the offline CUAD evaluations

```bash
python3 evaluation/download_cuad.py
python3 evaluation/evaluate_cuad.py \
  --dataset evaluation/data/CUAD_v1.zip

unzip evaluation/data/CUAD_v1.zip -d evaluation/data
node evaluation/evaluate_pdf_extraction.mjs \
  --dataset-dir evaluation/data/CUAD_v1
```

The presence evaluator reports precision, recall, F1, and confusion counts by Calder provision. The PDF benchmark compares PDF.js extraction with CUAD's matching plaintext and enforces the predeclared ingestion stop threshold. The app ZIP includes results, mapping, and scripts, but not CUAD's 105.9 MB archive.

The committed benchmark compared 509 matched CUAD PDF/plaintext pairs. Median token recall was 1.00 and every pair met the 0.80 recall floor, so the release's predeclared decision is `continue`.

## Useful commands

```bash
npm run dev       # local development
npm test          # workflow, scope, taxonomy, and UI regression tests
npm run lint      # code-quality validation
npm run check     # lint + tests + production build
npm run build     # production build
npm run preview   # preview the production build
```

## Documentation

- `docs/PROJECT_PLAN.md` - delivery plan and definition of done
- `docs/Calder_Agreement_Review_Project_Plan.docx` - presentation-ready Word project plan with workflows, architecture, evaluation results, and deployment guidance
- `docs/ARCHITECTURE_AND_WORKFLOW.md` - application, fallback, and evaluation flows
- `docs/DOCUMENT_REVIEW_PATHS.md` - how AI, deterministic, and manual submissions are reviewed, and how confidence scores are calculated
- `docs/CHANGE_LOG.md` - sponsor-initiated scope change
- `docs/SPONSOR_CORRESPONDENCE.md` - verbatim sponsor change notices
- `docs/COMPONENT_PROVENANCE_LOG.md` - Section 12.1 provenance log: which modules are AI-generated, hand-written, or substantially modified, and by whom
- `docs/DECISION_AND_AMBIGUITY_LOG.md` - authentication, retention, conditions, confidence, hosting, and known gaps
- `docs/CONFIDENCE_THRESHOLD_NOTE.md` - Section 6.4 threshold note: why 85, measured miss rates by category, and what counsel should and shouldn't rely on
- `docs/HOSTING_COMPARISON.md` - zero-budget deployment options and latency measurement protocol
- `docs/STRETCH_BACKLOG.md` - deferred standards/deviation/gap work
- `evaluation/cuad_to_calder_mapping.csv` - all 41 CUAD categories mapped or marked out of scope
- `evaluation/LABELING_HANDBOOK_SPOTCHECK.md` - Section 6.1 spot-check of real CUAD labels against category definitions
- `evaluation/CATEGORY_RELIABILITY.md` - Section 6.2: which categories are reliable, which aren't, and why
- `evaluation/independent-check/RESULTS.md` - Section 6.3 independent check: 10 modified Bonterms/Common Paper agreements nothing could have memorized
- `LICENSES/CUAD_ATTRIBUTION.md` - CUAD source, license, and citation
- `LICENSES/BONTERMS_COMMONPAPER_ATTRIBUTION.md` - Bonterms/Common Paper source, license, and use in the independent check

All automated findings are proposals requiring human verification. Use only approved contract data and follow the data policies of every configured service.

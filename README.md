# MIST7590EAICapstone

Group 3 Project

# Calder Agreement Review

Calder is a React/Vite vendor-agreement workflow that identifies whether selected provisions are present, shows supporting source text and confidence, and routes every result to a human reviewer. It runs locally, deploys to Vercel, and optionally uses Supabase for authentication, persistence, row-level security, and private document storage.

Version 1.6.4 implements the sponsor's presence-only scope amendment, CUAD taxonomy mapping and evaluation, resilient review screens, in-product detection-method guidance, and Safari-compatible browser-only searchable-PDF ingestion with PDF.js.

The application lives in [`Calder_Agreement_Review_V1/`](Calder_Agreement_Review_V1/). **Run every command below from that folder**, and read file paths in this README as relative to it. This guide assumes a clean machine, with nothing installed and no accounts configured.

## What it does

For each active category in the Requester-declared contract-type playbook, Calder answers one question: **is this provision present?** Positive findings contain the category, exact source text, confidence indicator, and analysis method. A reviewer accepts, dismisses, or escalates the finding with a reason.

The baseline does not extract values, compare legal standards, characterize deviations, assign risk severity, or create gaps from categories not found. That work is deliberately deferred and preserved as disabled stretch metadata; see `docs/STRETCH_BACKLOG.md` and `docs/CHANGE_LOG.md` for why.

### Analysis and fallback order

1. PDF.js extracts searchable PDF text in the browser.
2. An optional general-purpose hosted presence extractor can use CUAD definitions and exclusions.
3. An optional isolated CUAD-trained classifier experiment remains disabled by default.
4. CUAD-informed deterministic candidate retrieval runs without AI.
5. Guided manual identification remains available.

The recommended hosted path is a general-purpose model with a strict presence/source schema. Its self-reported confidence is ignored: Calder verifies that the source span occurs in the document and checks whether deterministic retrieval independently agrees. The optional CUAD-trained classifier service is an isolated experiment and is off by default; do not use CUAD contracts seen during training to report its evaluation metrics.

The playbook selects categories. Hosted extractors never receive Calder's draft risk standards. If risk decisions are enabled later as stretch work, only Calder's versioned playbook engine may make them.

### Agreement types

The Requester selects one of Calder's procurement intake values; the application never infers it:

- Software Subscription
- Professional Services
- Licensing
- Logistics and Freight
- Data Processing Addendum
- Mutual NDA
- Other

### Accounts and role-based access

- **Submitter**: submit agreements and track outcomes.
- **Reviewer**: Submitter access plus the review queue, manual findings, and accept, dismiss, or escalate actions.
- **Approver**: Reviewer access plus the ability to resolve escalated items.
- **Administrator**: manage active playbook categories, roles, reporting, and audit history.

Every new account starts as a Submitter. Only an Administrator can assign elevated roles. Supabase Auth hashes passwords and issues expiring sessions; database row-level security and stored functions enforce authorization on the server. Hiding navigation is only a usability layer, not the security boundary.

## Prerequisites

- **Node.js 22.x**, which `package.json` pins in its `engines` field. Check with `node -v`. If you have a different major version, install [nvm](https://github.com/nvm-sh/nvm) and run `nvm install 22 && nvm use 22`. Newer versions mostly work with warnings, but 22 is what is built and deployed against, so check this first when something fails oddly.
- **npm** (comes with Node) and **git**.
- For Supabase mode: a free **Supabase** account ([supabase.com](https://supabase.com)).
- For deployment: a free/Hobby **Vercel** account ([vercel.com](https://vercel.com)).
- Optional: an **OpenAI API key** for the hosted AI extraction path. Without one, Calder uses deterministic analysis.

## 1. Clone and install

```bash
git clone <your-repo-url>
cd MIST7590EAICapstone/Calder_Agreement_Review_V1
npm install
npm run check   # lint, tests, and production build
```

If `npm run check` fails on a fresh clone, fix that before moving on; everything below assumes a healthy build.

Do **not** run `npm install -g vercel` on macOS. It commonly fails with `EACCES: permission denied`. Use `npx vercel <command>` instead, which runs the CLI without a global install.

## 2. Run locally

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
2. In **SQL Editor → New query**, paste and run the complete `supabase/schema.sql`. It creates the five tables (`profiles`, `agreements`, `findings`, `playbook_rules`, `audit_events`), row-level security policies, the `assign_user_role` function, private object storage, and seed playbook data. Existing v1.5 deployments must rerun it to migrate shorthand agreement types and allow the `present` finding type while retaining historical findings.
3. Confirm **Email** auth is enabled under **Authentication → Providers** (on by default). Email verification, password reset, MFA, and account lockout are not required by the project.
4. Under **Authentication → URL Configuration**, set **Site URL** to `http://localhost:5173`. If it stays at Supabase's default `http://localhost:3000`, signup and password-reset emails link to a port nothing is running on.
5. Under **Project Settings → API**, copy the **Project URL** and the **anon / publishable** key. Never use the `service_role` key in this project.
6. Create `Calder_Agreement_Review_V1/.env.local` containing:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   ```

   These are safe in the browser: the anon key has no inherent permissions, and row-level security is the real boundary. `.env.local` is git-ignored by the repository's `.gitignore` (`.env*`); keep it that way.

7. Start the app. Restart it if it was already running, because Vite reads `.env.local` only at startup.

   ```bash
   npm run dev
   ```

8. Open `http://localhost:5173` and create an account. A database trigger creates its `profiles` row with `role = submitter`.

#### Bootstrap your first Administrator

The app cannot do this for you: `assign_user_role()` requires the caller to already be an Administrator, and every new account is a Submitter. Promote your first account once, in **SQL Editor**:

```sql
update public.profiles set role = 'administrator'
where id = (select id from auth.users where email = 'you@example.com');
```

Alternatively, edit the `role` column of your row in **Table Editor → profiles**. The dashboard bypasses row-level security, so either way works. After that, promote teammates from inside the app.

Under plain `npm run dev`, **`/api/analyze` does not exist**: it is a Vercel serverless function, and Vite's dev server doesn't run those. **Automatic** analysis always falls back to deterministic here. That is expected, not a bug.

### Option C: Supabase plus the hosted AI path

To make `/api/analyze` work locally, use the Vercel CLI's local emulation instead of plain `npm run dev`:

```bash
npx vercel login
npx vercel link                 # connect this folder to your Vercel project
npx vercel env pull .env.local  # overwrites .env.local
npx vercel dev
```

`vercel env pull` replaces `.env.local` with your Vercel project's variables, including `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `OPENAI_API_KEY`, which the serverless function needs. **Those must be scoped to the Development environment** in Vercel (**Settings → Environment Variables** → edit each → check **Development**), or the pull silently skips them.

Watch the terminal for the actual port; `vercel dev` sometimes binds to `3000` rather than `5173`.

`vercel.json` already scopes its SPA rewrite so it does not swallow Vite's dev-only requests:

```json
{ "rewrites": [ { "source": "/((?!api/|src/|@vite/|@react-refresh|node_modules/).*)", "destination": "/index.html" } ] }
```

If it is ever changed back to a catch-all `/(.*)`, `vercel dev` breaks with `Failed to parse source for import analysis`.

## 3. Test the analysis modes

These steps work in demo or Supabase mode:

1. Open **New intake**, choose an agreement type, and upload a searchable PDF or TXT file.
2. Choose **Deterministic only** and confirm source-linked presence findings are created, with no network call.
3. Choose **Manual review only**. No findings are generated; use **Add manual finding** in the reviewer queue instead.
4. Choose **Automatic**. With hosted keys configured and reachable (Option C or the deployed site), it calls the hosted extractor first; otherwise it falls back to deterministic analysis.
5. Upload an image-only PDF and confirm intake rejects it before storage with a clear message.

TXT remains available for corpus testing; searchable PDF is the required project format. DOCX and OCR are outside the required scope.

To verify a file's extractability before testing it in the UI:

```bash
npm run verify:ingestion -- "/absolute/path/to/Contract 1.pdf"
npm run verify:ingestion -- "/absolute/path/to/contract.txt"
```

The command reports file size, page count for PDFs, searchable character count, an extraction preview, and an accepted/rejected decision. The supplied `Contract 1.pdf` was verified at 146 pages and 225,021 searchable characters.

## 4. Deploy to Vercel (zero-dollar stack)

1. Push the repository to GitHub, with exactly one application folder (`Calder_Agreement_Review_V1`).
2. Import the repository into Vercel.
3. Under **Settings → General**, set **Root Directory** to `Calder_Agreement_Review_V1`.
4. Confirm Framework **Vite**, Build Command `npm run build`, and Output Directory `dist`.
5. Under **Settings → Environment Variables**, add the following, checking **Production, Preview, and Development** for each:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL` (same value; the serverless function needs an unprefixed copy because Vite only exposes `VITE_` variables to the browser bundle)
   - `SUPABASE_ANON_KEY` (same value)
   - Optionally `OPENAI_API_KEY` and `OPENAI_MODEL`, to enable hosted AI extraction
6. Mark `OPENAI_API_KEY` as Sensitive if your plan offers it; it authenticates a billed API. Vercel's "exposed to the browser" warning on `VITE_SUPABASE_ANON_KEY` is expected, because that key is meant to be public.
7. Deploy. Then, in **Supabase → Authentication → URL Configuration**, add your `https://your-app.vercel.app` domain to **Site URL** and **Redirect URLs** so auth emails point at the deployed app.
8. Environment variable changes don't apply to an existing build. After adding or editing variables, **Redeploy** (Deployments → active deployment → ⋯ → Redeploy).
9. Compare observed analysis time in the audit log with the limits of the selected free tier before committing to a hosted model architecture.

The optional Python classifier cannot run on Vercel's static frontend. Place it on a separate free service only after its cold-start and contract-analysis duration are measured. See `classifier-service/README.md`.

## 5. Run the offline CUAD evaluations

```bash
python3 evaluation/download_cuad.py
python3 evaluation/evaluate_cuad.py \
  --dataset evaluation/data/CUAD_v1.zip

unzip evaluation/data/CUAD_v1.zip -d evaluation/data
node evaluation/evaluate_pdf_extraction.mjs \
  --dataset-dir evaluation/data/CUAD_v1
```

The presence evaluator reports precision, recall, F1, and confusion counts by Calder provision. The PDF benchmark compares PDF.js extraction with CUAD's matching plaintext and enforces the predeclared ingestion stop threshold. The repository includes results, mapping, and scripts, but not CUAD's 105.9 MB archive.

The committed benchmark compared 509 matched CUAD PDF/plaintext pairs. Median token recall was 1.00 and every pair met the 0.80 recall floor, so the release's predeclared decision is `continue`.

## Troubleshooting

- **Safari: "This browser could not extract the PDF text"**: try the same file in Chrome or Edge first. A console error like `Worker task was terminated` is a PDF.js/Safari Web Worker issue, not your file; it can happen on a valid PDF, especially if the tab was backgrounded during upload.
- **`npm install -g vercel` fails with `EACCES`**: don't change npm's global permissions; use `npx vercel <command>`.
- **`npm warn EBADENGINE`**: your Node version doesn't match the pinned `22.x`. Usually only a warning; switch with `nvm use 22` if anything stranger happens.
- **Signup or password-reset link goes to `localhost:3000` and fails**: Supabase's Site URL is still the default. Set it under Authentication → URL Configuration (step 2, Option B, item 4, or deploy step 7).
- **App still shows demo data after adding `.env.local`**: restart `npm run dev`; Vite reads env files only at startup.
- **`vercel dev` throws `Failed to parse source for import analysis`**: the SPA rewrite in `vercel.json` is intercepting Vite's dev requests. See Option C.
- **Vercel dashboard settings are grayed out or won't save**: check your role on the Vercel team. Owner/Administrator can edit; Developer/Member often can't. Ask the project owner to make the change or raise your role.
- **Automatic mode always falls back to deterministic, even with OpenAI configured**: plain `npm run dev` never runs `/api/analyze`. Under `vercel dev`, confirm `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `OPENAI_API_KEY` are scoped to Development and that you re-ran `npx vercel env pull .env.local`. On the deployed site, check the function logs (Deployments → active deployment → Functions → `api/analyze`).

## Useful commands

```bash
npm run dev        # local development (frontend only, no /api routes)
npx vercel dev     # local development with working /api routes
npm test           # workflow, scope, taxonomy, and UI regression tests
npm run lint       # code-quality validation
npm run check      # lint + tests + production build
npm run build      # production build
npm run preview    # preview the production build
npm run verify:ingestion -- "/absolute/path/to/file.pdf"   # check a file's extractable text
npm run evaluate:independent-check   # Section 6.3 check against 10 modified standard-form agreements
```

## Documentation

All paths are inside `Calder_Agreement_Review_V1/`.

- `docs/PROJECT_PLAN.md`: delivery plan and definition of done
- `docs/Calder_Agreement_Review_Project_Plan.docx`: presentation-ready Word project plan with workflows, architecture, evaluation results, and deployment guidance
- `docs/ARCHITECTURE_AND_WORKFLOW.md`: application, fallback, and evaluation flows
- `docs/DOCUMENT_REVIEW_PATHS.md`: how AI, deterministic, and manual submissions are reviewed, and how confidence scores are calculated
- `docs/CHANGE_LOG.md`: sponsor-initiated scope change (Sept 9) and what it removed and added
- `docs/SPONSOR_CORRESPONDENCE.md`: verbatim sponsor change notices
- `docs/COMPONENT_PROVENANCE_LOG.md`: Section 12.1 provenance log of which modules are AI-generated, hand-written, or substantially modified, and by whom
- `docs/DECISION_AND_AMBIGUITY_LOG.md`: authentication, retention, conditions, confidence, hosting, and known gaps
- `docs/CONFIDENCE_THRESHOLD_NOTE.md`: Section 6.4 threshold note covering why 85, measured miss rates by category, and what counsel should and shouldn't rely on
- `docs/HOSTING_COMPARISON.md`: zero-budget deployment options and latency measurement protocol
- `docs/STRETCH_BACKLOG.md`: deferred standards/deviation/gap work, and what has to be true before building it
- `evaluation/cuad_to_calder_mapping.csv`: all 41 CUAD categories mapped or marked out of scope
- `evaluation/results/`: precision and recall by category
- `evaluation/LABELING_HANDBOOK_SPOTCHECK.md`: Section 6.1 spot-check of real CUAD labels against category definitions
- `evaluation/CATEGORY_RELIABILITY.md`: Section 6.2 on which categories are reliable, which aren't, and why
- `evaluation/independent-check/RESULTS.md`: Section 6.3 independent check on 10 modified Bonterms/Common Paper agreements nothing could have memorized
- `LICENSES/CUAD_ATTRIBUTION.md`: CUAD source, license, and citation
- `LICENSES/BONTERMS_COMMONPAPER_ATTRIBUTION.md`: Bonterms/Common Paper source, license, and use in the independent check

All automated findings are proposals requiring human verification. Use only approved contract data and follow the data policies of every configured service.

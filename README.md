# MIST7590EAICapstone
Group 3 Project

# Calder Agreement Review

Calder is a React/Vite vendor-agreement workflow that identifies whether selected provisions are present, shows supporting source text and confidence, and routes every result to a human reviewer. It runs locally, deploys to Vercel, and uses Supabase for authentication, persistence, row-level security, and private document storage.

Version 1.6.4 implements the sponsor's presence-only scope amendment, CUAD taxonomy mapping and evaluation, resilient review screens, in-product detection-method guidance, and browser-only searchable-PDF ingestion with PDF.js.

This README assumes a clean machine — nothing installed yet, no accounts configured. It's written from an actual first-time setup, including the gaps that weren't obvious the first time through.

## What it does

For each active category in the Requester-declared contract-type playbook, Calder answers one question: **is this provision present?** Positive findings contain the category, exact source text, confidence indicator, and analysis method. A reviewer accepts, dismisses, or escalates the finding with a reason.

The baseline does not extract values, compare legal standards, characterize deviations, assign risk severity, or create gaps from categories not found — that work is deliberately deferred; see `docs/STRETCH_BACKLOG.md` and `docs/CHANGE_LOG.md` for why.

## Prerequisites

- **Node.js 22.x** — the project pins this in `package.json`'s `engines` field. If you have a different major version (`node -v` to check), install [nvm](https://github.com/nvm-sh/nvm) and run `nvm install 22 && nvm use 22` before continuing. A newer Node (e.g. 24 or 25) will mostly work with warnings, but 22 is what's actually being built and deployed against — don't debug a weird failure for an hour before checking this.
- **npm** (comes with Node)
- **git**
- A **Supabase** account (free tier) — [supabase.com](https://supabase.com)
- A **Vercel** account (free/Hobby tier) — [vercel.com](https://vercel.com)
- Optional: an **OpenAI API key** if you want the hosted AI extraction path rather than relying on deterministic-only analysis

## 1. Clone and install

```bash
git clone <your-repo-url>
cd <repo-folder>
npm install
```

Do **not** run `npm install -g vercel` on macOS — it commonly fails with `EACCES: permission denied` because your user account lacks write access to the global npm directory. Use `npx vercel <command>` for every Vercel CLI command instead (covered below) — it runs the CLI without installing anything globally.

Sanity-check the install:
```bash
npm run check
```
This runs lint, the test suite, and a production build in one shot. If this fails on a fresh clone, stop and fix it before moving on — everything below assumes a healthy build.

## 2. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. In the dashboard, go to **SQL Editor → New query**, paste the entire contents of `supabase/schema.sql`, and run it. This creates all five tables (`profiles`, `agreements`, `findings`, `playbook_rules`, `audit_events`), row-level security policies, the `assign_user_role` function, private object storage, and seed playbook data.
3. Confirm **Email** auth is enabled: **Authentication → Providers** (on by default).
4. Go to **Authentication → URL Configuration** and set **Site URL** to `http://localhost:5173` for now (you'll add your production URL later, in step 6). This matters more than it looks — if left at Supabase's default `http://localhost:3000`, every signup confirmation and password-reset email will link to a port nothing is running on, and the link will look broken/expired even when it isn't.
5. Go to **Project Settings → API** and copy your **Project URL** and your **anon / publishable key** (Supabase has renamed this key over time — look for either label; don't use the `service_role` key, that one's a secret and should never appear in this project).

## 3. Configure environment variables

The zip/repo may not include a `.env.example` — create `.env.local` in the project root yourself with:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

These two are **safe to expose in the browser** despite the naming — that's what `VITE_` prefixing is for, and Supabase's anon key has no inherent permissions; row-level security is the actual boundary, not key secrecy. Never put the `service_role` key here.

`.env.local` should already be excluded from git — check with `cat .gitignore`; it should list `.env*` (or `.env.local` specifically). If your `.gitignore` doesn't exist yet or doesn't cover it, add it before your first commit, not after.

## 4. Run it locally (frontend only, no hosted AI)

```bash
npm run dev
```

Open `http://localhost:5173` and sign up for an account. It lands in Supabase's `auth.users` table, and a trigger auto-creates a matching `profiles` row with `role = submitter`.

This mode is fast to iterate in, but **`/api/analyze` does not exist under plain `vite dev`** — it's a Vercel serverless function, and Vite's dev server doesn't run those. Selecting "Automatic" analysis mode will always fall back to deterministic analysis here; that's expected, not a bug.

### Bootstrap your first Administrator

This isn't handled anywhere in the UI, and it's easy to get stuck on: `assign_user_role()` requires the caller to already be an administrator, but every new signup starts as a `submitter`. To get your first admin account:

1. Supabase dashboard → **Table Editor → profiles**
2. Find your row (match by user ID or email via the joined `auth.users` table)
3. Manually change `role` to `administrator` (the dashboard bypasses RLS, so this works even though the app itself won't let you do it yet)

After that, you can promote teammates through the app's own Team/Users screen.

## 5. Run it locally with the real AI path working

If you need `/api/analyze` to actually work locally (not just on the deployed site), use the Vercel CLI's local emulation instead of plain `vite dev`:

```bash
npx vercel login
npx vercel link          # connect this folder to your Vercel project
npx vercel env pull .env.local
```

`vercel env pull` overwrites `.env.local` with whatever's configured in your Vercel project — including `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `OPENAI_API_KEY`, which the serverless function needs and plain `.env.local` from step 3 doesn't have. **Those three must be scoped to the "Development" environment in Vercel's dashboard** (Settings → Environment Variables → edit each → check "Development"), or this pull will silently skip them and you'll be stuck with the same fallback-to-deterministic behavior.

**Known conflict:** the default `vercel.json` in this repo has a catch-all SPA rewrite:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
Under `vercel dev`, this intercepts Vite's own internal dev requests (`/src/main.tsx`, `/@vite/client`, etc.) and serves them `index.html` instead, which breaks with `Internal server error: Failed to parse source for import analysis`. Fix it by scoping the rewrite:
```json
{
  "rewrites": [
    { "source": "/((?!api/|src/|@vite/|@react-refresh|node_modules/).*)", "destination": "/index.html" }
  ]
}
```
This doesn't change production behavior — it just stops the rewrite from swallowing dev-only asset paths that don't exist in a production build anyway.

Then:
```bash
npx vercel dev
```
Watch the terminal output for the actual port — it sometimes binds to `3000` rather than `5173`.

## 6. Deploy to Vercel

1. Push the repo to GitHub. Make sure only **one** application folder exists in the repo — if you're working from a duplicated/renamed copy, delete the stale one first (`git rm -r <folder>`) so there's no ambiguity about which folder is actually being deployed.
2. Import the repository into Vercel.
3. If the app lives in a subfolder rather than the repo root, set **Root Directory** to that subfolder under **Settings → General**; otherwise leave it blank.
4. Confirm Framework is **Vite**, Build Command `npm run build`, Output Directory `dist`.
5. Under **Settings → Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL` (same value as the VITE_ one — the serverless function needs its own unprefixed copy since Vite strips non-`VITE_` vars from the browser bundle)
   - `SUPABASE_ANON_KEY` (same value as the VITE_ one)
   - Optionally `OPENAI_API_KEY` and `OPENAI_MODEL`, to enable hosted AI extraction
   - **Check Production, Preview, AND Development** for each — it's easy to only check Production and then be confused later when local `vercel dev` can't find them.
6. Mark `OPENAI_API_KEY` as Sensitive if your Vercel plan offers that option — it authenticates against a billed API and should be treated as a secret. `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` will trigger Vercel's "this is exposed to the browser" warning on the `VITE_`-prefixed one; that's expected and fine, ignore it — that key is meant to be public.
7. Deploy. Then go back to **Supabase → Authentication → URL Configuration** and add your live `https://your-app.vercel.app` domain to both **Site URL** and **Redirect URLs**, so signup/password-reset emails point at the real deployed app instead of localhost.
8. Env var changes don't apply to an already-built deployment — after adding/editing variables, **Redeploy** (Deployments tab → active deployment → ⋯ → Redeploy) rather than assuming it picks them up automatically.

## Testing analysis modes

1. **New intake** → choose an agreement type → upload a searchable PDF or TXT file.
2. Try **Deterministic only** — findings should appear instantly with highlighted source text, no network call.
3. Try **Manual review only** — no findings are generated; use **Add manual finding** in the reviewer queue instead.
4. Try **Automatic** — with hosted keys configured and reachable, this calls OpenAI first; without them (or under plain `npm run dev`), it falls back to deterministic automatically.
5. Upload an image-only/scanned PDF and confirm intake rejects it before storage, with a clear message, rather than silently failing later.

Verify a file's extractability outside the browser before testing it in the UI:
```bash
npm run verify:ingestion -- "/absolute/path/to/file.pdf"
```

## Troubleshooting

- **Safari: "This browser could not extract the PDF text"** — try the same file in Chrome/Edge first to isolate whether it's Safari-specific. If you see a console error like `Worker task was terminated`, that's a PDF.js/Safari Web Worker issue, not your file — it can happen even on a valid PDF, especially if the tab was backgrounded during upload. Chrome/Edge don't have this issue; use them if you hit it repeatedly with the same file.
- **`npm install -g vercel` fails with `EACCES`** — don't fix npm's global permissions; just use `npx vercel <command>` instead of installing globally.
- **`npm warn EBADENGINE`** — your Node version doesn't match the pinned `22.x`. Usually a warning, not a blocker, but switch with `nvm use 22` if you hit anything stranger.
- **Password reset / signup link goes to `localhost:3000` and fails** — Supabase's Site URL is still at its default. Set it under Authentication → URL Configuration to match whatever you're actually running (step 2.4 or step 6.7).
- **`vercel dev` throws `Internal server error: Failed to parse source for import analysis`** — the `vercel.json` SPA rewrite is intercepting Vite's dev-only requests. See the fix in step 5.
- **Vercel dashboard settings are grayed out / won't save** — check your role on the Vercel team (Owner/Administrator can edit; Developer/Member often can't touch certain project settings). Ask whoever owns the project to make the change or bump your role.
- **`Automatic` mode always falls back to deterministic, even after configuring OpenAI** — confirm which environment you're testing in. Plain `npm run dev` never runs `/api/analyze` regardless of configuration (step 4). Under `vercel dev`, confirm `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `OPENAI_API_KEY` are scoped to "Development" in Vercel and that you re-ran `vercel env pull .env.local` after adding them. On the deployed URL, check the function logs (Deployments → active deployment → Functions → `api/analyze`) for the real error.

## Useful commands

```bash
npm run dev       # local development (frontend only, no /api routes)
npx vercel dev     # local development with working /api routes
npm test          # workflow, scope, taxonomy, and UI regression tests
npm run lint      # code-quality validation
npm run check     # lint + tests + production build
npm run build     # production build
npm run preview   # preview the production build
npm run evaluate:independent-check   # Section 6.3 check against 10 modified standard-form agreements
```

## Documentation

- `docs/PROJECT_PLAN.md` / `docs/Calder_Agreement_Review_Project_Plan.docx` — delivery plan, workflows, architecture, evaluation results
- `docs/ARCHITECTURE_AND_WORKFLOW.md` — application, fallback, and evaluation flows
- `docs/CHANGE_LOG.md` — sponsor-initiated scope change (Sept 9) and what it removed/added
- `docs/SPONSOR_CORRESPONDENCE.md` — verbatim text of sponsor change notices
- `docs/COMPONENT_PROVENANCE_LOG.md` — Section 12.1 provenance log: which modules are AI-generated, hand-written, or substantially modified, and by whom
- `docs/DECISION_AND_AMBIGUITY_LOG.md` — authentication, retention, conditions, confidence, hosting, and known gaps
- `docs/CONFIDENCE_THRESHOLD_NOTE.md` — Section 6.4 threshold note: why 85, measured miss rates by category, and what counsel should and shouldn't rely on
- `docs/HOSTING_COMPARISON.md` — zero-budget deployment options
- `docs/STRETCH_BACKLOG.md` — deferred standards/deviation/gap work, and what has to be true before building it
- `evaluation/cuad_to_calder_mapping.csv` / `evaluation/results/` — CUAD category mapping and precision/recall by category
- `evaluation/LABELING_HANDBOOK_SPOTCHECK.md` — Section 6.1 spot-check of real CUAD labels against category definitions
- `evaluation/CATEGORY_RELIABILITY.md` — Section 6.2: which categories are reliable, which aren't, and why
- `evaluation/independent-check/RESULTS.md` — Section 6.3 independent check: 10 modified Bonterms/Common Paper agreements nothing could have memorized
- `LICENSES/CUAD_ATTRIBUTION.md` — CUAD source, license, and citation
- `LICENSES/BONTERMS_COMMONPAPER_ATTRIBUTION.md` — Bonterms/Common Paper source, license, and use in the independent check

# Calder Agreement Review — Portable Edition v1.5.1

A React/Vite application with three review paths: authenticated AI extraction, deterministic PDF/TXT analysis when AI is unavailable, and guided manual review. It runs locally, deploys to Vercel, and optionally uses Supabase for authentication, persistence, row-level security, and private document storage.

Version 1.5.1 adds a responsive, accessible Calder sign-in and account-creation experience while preserving the existing authorization and review workflows.

## Accounts and role-based access

The application supports the four roles required by the project brief:

- **Submitter** (the brief's Requester): submit agreements and track outcomes.
- **Reviewer**: Submitter access plus the review queue, manual findings, and accept, dismiss, or escalate actions.
- **Approver**: Reviewer access plus the ability to resolve escalated items.
- **Administrator**: manage playbooks, access requests, reporting, and audit history.

Every new account safely starts as a Submitter. Users can edit their name but cannot change or request permissions from profile settings. Only an Administrator can assign Reviewer, Approver, or Administrator access. Navigation and server/database actions are both role-restricted.

## Run locally immediately

Prerequisites: Node.js 20.19+ and npm.

```bash
cd calder-agreement-review
npm install
npm run dev
```

Open `http://localhost:5173`. With no `.env.local`, the app enters **local demo mode** with seeded data stored only in your browser. The sidebar can reset the demo data.

## Connect Supabase

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it. Existing projects should rerun the complete file to add profiles, administrator-controlled roles, role-based RLS, analysis-method tracking, and TXT storage support.
3. In **Authentication > Providers**, keep Email enabled. For quick testing, you may disable email confirmation.
4. Copy `.env.example` to `.env.local`.
5. Add your project URL and publishable/anon key:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

6. Restart `npm run dev`, create a test account, and sign in.

Never put a Supabase service-role key in this frontend project. The browser uses only the publishable/anon key; database and storage access are protected by the included row-level security policies.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, select **Add New > Project** and import the repository.
3. Vercel should detect Vite. Use:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` in **Project Settings > Environment Variables**.
5. To enable AI, add the server-only `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. Never create a `VITE_OPENAI_API_KEY`.
6. Deploy.

The included `vercel.json` routes browser refreshes back to the React application.

## Useful commands

```bash
npm run dev      # local development
npm test         # automated workflow and UI regression tests
npm run lint     # code-quality validation
npm run check    # lint + tests + production build
npm run build    # production build
npm run preview  # preview the production build
```

## Current scope

- Private PDF/TXT intake and browser-side searchable-text extraction
- AI analysis through an authenticated serverless route when configured
- Automatic deterministic fallback using headings, keywords, regex, source snippets, and contract-type playbook rules
- Guided manual review when automation is disabled, fails, or needs correction
- Agreement-type playbooks for SaaS, Professional Services, and DPA
- Source-linked manual findings
- Accept, dismiss, and escalate decisions with reasons
- Review queue, reporting, and audit history
- Browser-only demo mode and Supabase-connected mode
- Account creation, profile settings, administrator-only role assignment, and role-specific navigation/actions

All automated findings are proposals requiring human verification. Automatic mode tries AI first and immediately falls back to deterministic analysis if the AI route is disabled or unavailable. Contract text is sent to the configured AI provider only when AI mode succeeds; use synthetic or approved contracts and follow your organization’s data policy.

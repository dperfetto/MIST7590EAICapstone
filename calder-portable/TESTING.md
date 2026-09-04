# Calder verification log

## Production validation

- TypeScript compilation: Passed
- Vite production build: Passed
- Local demo data adapter: Retained
- Supabase data adapter, authentication, and PDF storage: Retained
- Agreement intake, findings, decisions, playbooks, reporting, and audit views: Retained

## UI guardrails

- Sidebar overflow: Passed — the desktop rail is independently scrollable and cannot cover the content column.
- Collapse control: Passed — open rail is 286 px; collapsed icon rail is 76 px.
- Navigation readability: Passed — labels remain visible in the open state and icons remain available in the collapsed state.
- Active state: Passed — selected navigation has contrasting text, fill, border, and left indicator.
- Account panel: Passed — profile and session actions remain at the bottom of the open rail.
- Responsive behavior: Passed — at 700 px and below, the rail becomes a bounded drawer with backdrop and close behavior.
- Main content sizing: Passed — the workspace uses `minmax(0, 1fr)` and expands when the rail collapses.
- Keyboard focus: Passed — navigation and collapse controls have visible focus indicators and accessible labels.
- Legacy toolbar conflict: Passed — obsolete seven-column and forced full-width sidebar rules were removed and are prohibited by regression tests.
- Grid placement: Passed — the sidebar is explicitly locked to column 1 and the workspace to column 2; neither depends on automatic browser placement.

## Automated regression suite

- ESLint: Passed with zero warnings or errors
- Node test runner: 9 of 9 tests passed
- Contract-type playbook coverage: Passed
- Intake, review decision, manual finding, rule update, and audit mutation paths: Passed
- PDF type and 10 MB size validation: Passed
- Supabase workflow schema and row-level security declarations: Passed
- Production asset server smoke test: Passed
- Three-tier analysis: Passed — authenticated AI, active-playbook-driven deterministic fallback, and guided manual review are wired to the same finding workflow.

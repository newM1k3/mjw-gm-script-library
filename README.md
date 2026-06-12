# MJW GM Script Library

The **MJW GM Script Library** is a Vite, React, and TypeScript application for managing escape room game-master scripts, version history, hint ladders, pronunciation notes, staff acknowledgements, operational readiness, and exportable room packets. It supports a browser-based demo mode for local evaluation and a production PocketBase adapter for live operations. The application is designed for the MJW Personal App Platform pattern: a focused operations tool with clear release documentation, server-side integrations, and safe manager approval gates.

## Current Status

The app is now a feature-complete release candidate for GM script operations. Demo mode remains available through localStorage and sample data restore, while production mode is wired through `src/lib/dataAdapter.ts` and documented PocketBase collections. Netlify Functions provide server-side data export and AI-assisted rewriting so privileged keys are never exposed to the browser. Prompt 13 added final polish, accessible confirmation flows, quick navigation, app-version display, and release documentation.

| Area | Current State | Production Responsibility |
|---|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, responsive app shell, quick navigation, and version display | Keep UI changes small, tested, and consistent across screens |
| Persistence | Demo localStorage mode plus PocketBase production adapter boundary | Create and maintain PocketBase collections, rules, backups, and operator accounts |
| Readiness | Actionable readiness audit dashboard with issue categories, filters, remediation links, room checklists, metadata, and JSON/Markdown exports | Review audit issues before each operational rollout and after major script changes |
| Import/Export | Schema-versioned exports using `gms_export_schema_version: "1.0.0"`, safe room-packet preview, merge, and overwrite flows | Preserve schema compatibility for downstream MJW tools and document breaking changes |
| AI Rewrite | Netlify Function wrapper for OpenAI or Gemini, draft-only output, required-block preservation checks, before/after diff, and manager approval gate | Store provider API keys server-side only and review all generated drafts before approval |
| Deployment | Netlify-ready build with serverless functions and production environment variable support | Configure Netlify, PocketBase, environment variables, smoke tests, and rollback plan |
| Validation | Vitest, TypeScript, ESLint, and Vite production build scripts | Run all checks before every release commit |

## Local Development

Install dependencies, run the development server, and validate changes before committing. The repository uses `pnpm` in the active development workflow.

```bash
pnpm install
pnpm dev
```

Run the full local verification suite before release or handoff.

```bash
pnpm test -- --run
pnpm exec tsc --noEmit
pnpm run lint
pnpm build
```

The local development server is provided by Vite. The production build output is written to `dist`.

## Key Features

The library centers on operational script control. Managers can maintain room records, edit scripts, preserve version history, manage hint ladders and pronunciation guides, assign staff acknowledgements, and run readiness checks before a room goes live. The GM-oriented data model keeps scripts, versions, hints, pronunciation terms, staff acknowledgements, and audit events in one coherent app state.

The **Readiness Audit** identifies operational gaps across room, script, staff, hint, and pronunciation categories. It produces actionable remediation targets, room-level readiness checklists, duplicate suppression, orphan detection, audit metadata, and exportable reports.

The **Export Center** publishes room packets, staff acknowledgement reports, readiness audit reports, full backups, and integration packets under schema version `1.0.0`. Room-packet imports are validated before application and support safe merge or confirmed room overwrite. Production full backups can be generated through the Netlify export function so server-side data is not dependent on stale browser state.

The **AI Rewrite** workflow is intentionally conservative. Requests are sent only to a Netlify Function, using `AI_PROVIDER` with either OpenAI or Gemini credentials stored as server-side environment variables. Returned text is saved only as a draft, displayed with a before/after diff, checked for required safety and policy block preservation, and cannot bypass manager approval.

## Netlify Deployment

This repository includes `netlify.toml` configured for Vite and Netlify Functions.

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"
```

Create a Netlify site from the GitHub repository, use the `main` branch, keep the build command as `npm run build` or the Netlify-equivalent package-manager command, and publish `dist`. For demo deployments, set `VITE_DATA_MODE=demo`. For production deployments, set `VITE_DATA_MODE=pocketbase` and `VITE_POCKETBASE_URL` after the external PocketBase instance is configured.

## Environment Variables

Copy `.env.example` to `.env.local` for local configuration testing. Do not commit `.env.local`, service tokens, API keys, or production secrets.

| Variable | Scope | Safe in Browser? | Purpose |
|---|---:|---:|---|
| `VITE_DATA_MODE` | Frontend | Yes | Selects `demo` localStorage mode or `pocketbase` production adapter mode |
| `VITE_POCKETBASE_URL` | Frontend | Yes | Public URL of the PocketBase instance used when `VITE_DATA_MODE=pocketbase` |
| `VITE_APP_ENV` | Frontend | Yes | Optional deployment label for development, preview, or production |
| `AI_PROVIDER` | Netlify Function | No | Selects `openai` or `gemini` for server-side AI rewriting |
| `OPENAI_API_KEY` | Netlify Function | No | OpenAI key used only by `netlify/functions/rewrite-script.ts` |
| `OPENAI_MODEL` | Netlify Function | No | Optional OpenAI model override |
| `GEMINI_API_KEY` | Netlify Function | No | Gemini key used only by `netlify/functions/rewrite-script.ts` |
| `GEMINI_MODEL` | Netlify Function | No | Optional Gemini model override |
| `PB_SERVICE_URL` | Netlify Function | No | PocketBase service URL for server-side production exports |
| `PB_SUPERUSER_TOKEN` | Netlify Function | No | PocketBase service/admin token for server-side export only; never expose client-side |

## Documentation

Production setup and release verification are documented in `docs/release-checklist.md`. Export contracts, schema envelopes, import behavior, and downstream expectations are documented in `docs/export-schema.md`. PocketBase collection expectations and security notes are documented in `docs/pocketbase-schema.md`.

## Data Model

The TypeScript model in `src/types.ts` covers rooms, scripts, script versions, hint ladders, pronunciation terms, staff members, acknowledgements, audit events, readiness metadata, and app state. The adapter boundary preserves the component-facing `AppState` shape while allowing production records to be stored in PocketBase collections. AI rewrite provenance is stored on script versions so managers can audit generated drafts and approval decisions.

## Known Limitations

Demo mode data remains local to the browser and should not be treated as a backup or production source of truth. PocketBase mode requires the external collections, access rules, users, backup policy, and operational monitoring described in the release checklist. AI-assisted rewriting depends on the configured provider and should be treated as drafting assistance only; required safety blocks must still be reviewed by a manager. The current automated tests focus on business logic, export contracts, audit logic, and serverless function behavior rather than exhaustive browser-level component coverage.

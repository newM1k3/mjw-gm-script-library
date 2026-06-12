# MJW GM Script Library Release Checklist

This checklist defines the production handoff path for the **MJW GM Script Library**. It should be completed before promoting a Netlify deployment to production or connecting live PocketBase data. The application can run in demo mode without backend services, but operational use requires PocketBase, Netlify Functions, server-side environment variables, and a verified rollback plan.

## 1. Pre-Release Validation

Run the complete local validation suite from the repository root before tagging or deploying a release. All checks must pass without ignored failures.

| Check | Command | Acceptance Criteria |
|---|---|---|
| Unit and contract tests | `pnpm test -- --run` | All Vitest suites pass, including audit logic, export schema contracts, import behavior, AI rewrite helpers, and Netlify function error paths |
| TypeScript | `pnpm exec tsc --noEmit` | No TypeScript errors |
| Lint | `pnpm run lint` | No ESLint errors blocking release |
| Production build | `pnpm build` | Vite build completes and writes `dist` |
| Git review | `git status --short` and `git diff --stat` | Only intentional release files are staged; local notes, locks, and helper scripts stay out of the release commit unless explicitly approved |

## 2. Netlify Deployment Setup

Create or update the Netlify site from the GitHub repository and deploy from the `main` branch. The repository includes `netlify.toml`, so Netlify should detect the build and function settings automatically.

| Setting | Value |
|---|---|
| Build command | `npm run build` or the Netlify package-manager equivalent |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |
| Production branch | `main` |
| Node runtime | Netlify default compatible with the repository build |

After the first deploy, confirm that the app loads, static assets resolve correctly, and both Netlify Functions are present in the deployment. The two server-side functions used by the current release are `export-gms-data` and `rewrite-script`.

## 3. Environment Variables

Environment variables must be configured in Netlify before production smoke testing. Variables marked server-side must never be exposed with a `VITE_` prefix.

| Variable | Required For | Scope | Notes |
|---|---|---|---|
| `VITE_DATA_MODE` | All deployments | Browser | Use `demo` for sample/localStorage deployments or `pocketbase` for production data |
| `VITE_POCKETBASE_URL` | PocketBase production mode | Browser | Public PocketBase base URL; safe only because it is not a credential |
| `VITE_APP_ENV` | Optional deployment labeling | Browser | Example values: `preview`, `production` |
| `AI_PROVIDER` | AI rewrite function | Server-side | Supported values: `openai` or `gemini` |
| `OPENAI_API_KEY` | OpenAI rewrite provider | Server-side | Required only when `AI_PROVIDER=openai` |
| `OPENAI_MODEL` | Optional OpenAI override | Server-side | Leave unset to use the function default |
| `GEMINI_API_KEY` | Gemini rewrite provider | Server-side | Required only when `AI_PROVIDER=gemini` |
| `GEMINI_MODEL` | Optional Gemini override | Server-side | Leave unset to use the function default |
| `PB_SERVICE_URL` | Server-side export | Server-side | PocketBase URL used by Netlify backup/export function |
| `PB_SUPERUSER_TOKEN` | Server-side export | Server-side | Privileged token used only inside Netlify Functions; never put this in frontend code |

## 4. PocketBase Production Setup

PocketBase must be configured before enabling production operations. Use `docs/pocketbase-schema.md` as the source of truth for collection names, fields, and rule intent.

| Step | Requirement |
|---|---|
| Create collections | Create room, script, script version, hint ladder, pronunciation, staff, acknowledgement, and audit-event collections matching the documented schema |
| Configure auth | Create manager/owner accounts and restrict privileged writes to authorized operators |
| Apply access rules | Ensure staff can access only intended read/acknowledgement workflows while manager-only screens remain protected |
| Seed initial data | Import or create rooms, current scripts, hint ladders, pronunciation terms, and staff records |
| Verify backups | Establish PocketBase database backup cadence and document restore location |
| Verify service token handling | Keep service tokens only in Netlify server-side environment variables or secure operational storage |

## 5. Production Smoke Tests

Complete these smoke tests in a Netlify preview first, then repeat on production after promotion. Use non-sensitive sample data unless a manager has explicitly approved live-data testing.

| Area | Smoke Test | Expected Result |
|---|---|---|
| App shell | Load the app, use sidebar navigation, mobile navigation, and desktop quick navigation | Screens switch correctly, focus rings are visible, version appears in the shell |
| Room setup | Create or edit a test room, then retire it | Shared confirmation modal appears and room status updates after confirmation |
| Script workflow | Create or edit a script version | Version history remains intact and no unrelated data changes |
| Hint ladders | Archive a test ladder | Shared confirmation modal appears and archived ladder is hidden from operational views |
| Pronunciation guide | Archive a test term | Shared confirmation modal appears and keyboard-visible actions remain accessible |
| Readiness audit | Run the readiness dashboard and use a remediation action | Audit issues, categories, checklists, and navigation targets are correct |
| Export center | Download room packet, readiness report, staff acknowledgement report, full backup, and integration packet | Files download with schema version `1.0.0` and expected payload shape |
| Import preview | Import a room packet and choose safe merge | Preview validates first, then merge applies only after user action |
| Import overwrite | Import a duplicate room packet and click overwrite | Destructive confirmation appears before room overwrite is applied |
| Server export | Trigger server-side full backup in production mode | Netlify Function returns a valid JSON export or a clear configuration error |
| AI rewrite | Request a rewrite on a non-critical test script | Provider call runs server-side, output is draft-only, diff appears, required-block warnings are shown if applicable, and manager approval is still required |
| Authentication | Sign in and sign out where production mode requires auth | Manager-only screens remain protected from unauthorized users |

## 6. Release Commit and Tagging

After validation and smoke testing, commit only the intentional release files. Do not include local notes, generated helper scripts, private environment files, or package-lock changes unless they are explicitly part of the approved release scope.

Recommended commit message format:

```bash
git commit -m "Polish GM script library release readiness"
```

Push to `origin/main`, confirm the Netlify deployment starts, and record the commit hash in the release notes.

## 7. Rollback Plan

Rollback must be possible without relying on browser-local data. Before promotion, confirm that the previous known-good Git commit and the latest PocketBase backup are identified.

| Scenario | Rollback Action |
|---|---|
| Frontend build regression | Roll Netlify back to the prior successful deploy and open a fix branch from the failed commit |
| Netlify Function regression | Roll back the deploy, then verify `rewrite-script` and `export-gms-data` function logs before redeploying |
| PocketBase schema issue | Stop production writes, restore the most recent verified PocketBase backup, and redeploy the previous compatible frontend if needed |
| AI provider outage | Disable AI rewrite by removing or changing server-side provider configuration; core script management remains usable |
| Bad imported data | Restore from the latest full backup or PocketBase backup, then re-run import with safe merge in a preview environment |

## 8. Known Release Notes

The current app is suitable for controlled production handoff once PocketBase and Netlify are configured. Demo mode is useful for evaluation but remains browser-local. AI output is drafting assistance only and must remain subject to manager review, required-block validation, and normal version approval procedures.

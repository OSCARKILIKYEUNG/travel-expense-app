# Travel app: Oscar's notes (codex workspace)

- Source: Phase 1 snapshot `5bfab55` (Desktop `travel-app-backup-2026-05-08`). Imported to the box on 2026-10-13.
- Work branch: `codex/optimize-from-phase1`. **Do not push.** The push URL is disabled on purpose.
- GitHub (already published — no re-upload needed): https://github.com/OSCARKILIKYEUNG/travel-expense-app — Vercel Production tracks `main`.
- Live: https://travel-expense-app-ten.vercel.app
- Run: `npm ci && npm run dev` (port 3000). Run `npx vitest run` for the tests and `npm run build` for the PWA build.
- Without a real `.env`, the UI loads but login/sync, AI receipt scan, and Stripe do not work. See `.env.example`. AI uses server-only `GEMINI_API_KEY` (not `VITE_GEMINI_API_KEY`); AI and Stripe need `vercel dev` or Vercel Production.
- The V2 redesign (uncommitted) lives only in the Desktop "travel app" folder. Port it later on its own branch.

## Docs

- Review and roadmap (2026-10-13): `/workspace/20-projects/cursor/projects/travel-app/research/2026-10-13-review/2026-10-13-travel-app-plan.md`
- Access + Gemini verification (2026-10-15): `/workspace/20-projects/cursor/projects/travel-app/research/2026-10-15-access-review/2026-10-15-travel-app-access-and-gemini.md`

## Cloud IDs (no secrets)

| Service | ID / ref |
|--------|----------|
| Vercel project | `travel-expense-app` (`prj_IN8XVRxtvPhXNRV31GwvYlf3iVfs`) |
| Supabase project | `travel-expense-app` (`acfgmzqeyyssauxnhslp`) |
| GCP project (Gemini) | `travel app` (`travel-app-491113`) |

2026-10-15 smoke test proved live AI scan hits GCP `travel-app-491113` (`GenerateContent` HTTP 200). Keep Gemini API + Vercel `GEMINI_API_KEY` enabled.

## AI scan quota (2026-10-15)

- Free limit: 5 lifetime scans per user (`FREE_RECEIPT_SCAN_LIMIT`), counted in `usage_logs` (`receipt_scan`).
- Pro: `user_app_data.subscription_status` in `active` | `trialing` → unlimited.
- Kill-switch (reversible): Vercel env `RECEIPT_SCAN_QUOTA_DISABLED=1` (and optional `VITE_RECEIPT_SCAN_QUOTA_DISABLED=1` for client UI). Unset to restore limits. Prefer per-account Pro for a single tester.

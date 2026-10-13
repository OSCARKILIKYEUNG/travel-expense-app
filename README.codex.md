# Travel app: Oscar's notes (codex workspace)

- Source: Phase 1 snapshot `5bfab55` (Desktop `travel-app-backup-2026-05-08`). Imported to the box on 2026-10-13.
- Work branch: `codex/optimize-from-phase1`. **Do not push.** The push URL is disabled on purpose.
- Run: `npm ci && npm run dev` (port 3000). Run `npx vitest run` for the tests and `npm run build` for the PWA build.
- Without a real `.env`, the UI loads but login/sync, AI receipt scan, and Stripe do not work. See `.env.example`. AI and Stripe need `vercel dev`.
- The V2 redesign (uncommitted) lives only in the Desktop "travel app" folder. Port it later on its own branch.
- Review and roadmap: `/workspace/20-projects/codex/output/2026-10-13-travel-app-review/2026-10-13-travel-app-plan.md`

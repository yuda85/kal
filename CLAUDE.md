# kal

Personal calorie and macro tracker. Food is logged by talking to Claude, who produces confirm-links.

- Spec: `docs/superpowers/specs/2026-09-27-kal-design.md`
- UI source of truth: `design-system/kal/MASTER.md`
- Plans: `docs/superpowers/plans/`

## Rules

- Simplest option wins. Nothing that is not in the spec.
- All calculations live in `domain/`. The app and the skill scripts import it; never duplicate a formula.
- `domain/` is framework-free TypeScript: erasable syntax only (no enums, namespaces, parameter properties), `.ts` import extensions, `import type` for types, zero runtime dependencies.
- Claude never writes to Firestore. It builds links with `.claude/skills/kal/scripts/link.ts`.
- No secrets in the repo. The Firebase web config is not a secret.
- UI text is Hebrew, RTL.
- Conventional Commits.

## Commands

- `npm test` — domain + skill tests
- `npm run typecheck`
- `npm run test:rules` — Firestore rules against the emulator (needs Java 21)

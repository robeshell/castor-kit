## What & why

<!-- What does this change, and why? Link the issue it resolves: "Closes #123". -->

## How was it tested?

<!-- Commands you ran, pages you checked. UI changes: add before / after screenshots. -->

## Checklist

- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass
- [ ] `pnpm verify` passes (and `pnpm verify -- --module <name>` for feature modules)
- [ ] Migrations were applied and checked in the database, if any
- [ ] RBAC changes are in `seed-rbac.ts` and synced with `pnpm seed:rbac -- --incremental`
- [ ] New UI text has en-US / ja-JP translations; code comments are in English
- [ ] Docs updated if behavior changed

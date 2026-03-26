# Development Workflow

When a task is completed, ensure the following are run:

## Frontend
1. `bun run check` in `packages/frontend` to ensure formatting, linting, and type checking pass.
2. `bun run test` to verify no regressions in the frontend.

## Backend
1. Ensure the code compiles and runs with `bun run dev`.
2. If database changes were made, run `bun run db:migrate` and `bun run db:generate`.
3. Check for any errors in the logs (Pino).

## General
- Review changes with `git diff`.
- Ensure new features have corresponding tests if applicable.

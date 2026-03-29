# AGENTS.md

This document provides essential information for agentic coding agents working in the BearUang repository. You are an expert TypeScript developer working with Bun runtime and Elysia. This project is an API.

## Project Overview

BearUang is a monorepo containing a backend API and a frontend SPA:

### Backend (`packages/backend/`)

- **Runtime**: Bun (v1.3.10+)
- **Framework**: Elysia.js
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: better-auth with organization support and API keys
- **Validation**: Zod
- **Logging**: Pino

### Frontend (`packages/frontend/`)

- **Framework**: React 19 + TanStack Start (SSR) + TanStack Router
- **Build**: Vite 7
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4 + shadcn/ui (radix-vega style) + Lucide icons
- **Forms**: TanStack Form + Zod v4 validation
- **Tables**: TanStack Table
- **Auth client**: better-auth/react + @elysiajs/eden (type-safe API client)
- **Linting**: ESLint (@tanstack/eslint-config) + Prettier
- **Testing**: Vitest + @testing-library/react + jsdom

## Project Structure

```
bearuang/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── generated/     # Prisma generated client (git-ignored)
│   │   │   ├── integrations/  # External service integrations (auth, prisma)
│   │   │   ├── libraries/     # Shared utilities and helpers
│   │   │   ├── plugins/       # Elysia plugins and middleware
│   │   │   └── index.ts       # Application entry point
│   │   ├── prisma/
│   │   │   ├── schema.prisma  # Database schema
│   │   │   └── migrations/
│   │   └── prisma.config.ts
│   └── frontend/
│       ├── src/
│       │   ├── components/    # React components
│       │   │   ├── ui/        # shadcn/ui primitives (button, input, label, checkbox)
│       │   │   └── layouts/   # Page layout components (auth-layout)
│       │   ├── routes/        # TanStack file-based routes
│       │   │   ├── __root.tsx # Root layout
│       │   │   ├── index.tsx  # Home page
│       │   │   ├── signin.tsx # Sign in page
│       │   │   └── signup.tsx # Sign up page
│       │   ├── lib/           # Shared libraries
│       │   │   ├── api.ts     # Eden API client (type-safe backend connection)
│       │   │   ├── auth-client.ts  # better-auth client with org + API key plugins
│       │   │   └── utils.ts   # cn() utility (clsx + tailwind-merge)
│       │   ├── router.tsx     # TanStack router configuration
│       │   ├── routeTree.gen.ts  # Auto-generated route tree (do not edit)
│       │   └── styles.css     # Global styles + Tailwind + shadcn theme
│       └── dist/
├── docker-compose.yml
└── package.json
```

## Development Commands

### Root Commands

```bash
bun install                  # Install all dependencies
bun run dev:backend          # Run backend with watch mode
bun run check                # Run lint/format/typecheck for both frontend and backend
```

### Backend Commands (run from packages/backend/)

```bash
bun run dev                  # Start development server with hot reload and pino-pretty
bun run db:generate          # Generate Prisma client
bun run db:migrate           # Create and apply migration (dev)
bun run db:migrate:deploy    # Apply migrations (production)
bun run db:push              # Push schema changes without migration
bun run db:studio            # Open Prisma Studio GUI
bun run db:seed              # Seed database
bun run db:reset             # Reset database (migrations + seed)
bun run db:validate          # Validate Prisma schema
```

### Frontend Commands (run from packages/frontend/)

```bash
bun run dev                 # Start dev server (port 3000 by default, or $PORT)
bun run build               # Production build
bun run preview             # Preview production build
bun run lint                # Run ESLint
bun run format              # Run Prettier (check only)
bun run check               # Run Prettier (fix) + ESLint (fix)
bun run test                # Run all tests (vitest run, single run)
bun vitest                  # Run tests in watch mode
bun vitest run src/path/to/file.test.ts   # Run a single test file
bun vitest run -t "test name pattern"     # Run tests matching name pattern
```

### Database Setup

```bash
docker-compose up -d         # Start PostgreSQL container
bun run db:migrate           # Apply migrations
bun run db:generate          # Generate Prisma client
```

## Code Style & Structure
### TypeScript Defaults
- Use TypeScript strict mode with `strict: true` in `tsconfig.json` — enables `strictNullChecks`, `noImplicitAny`, and other safety checks.
- Use `const` by default; `let` only when reassignment is needed. Never use `var`.
- Use `interface` for object shapes that may be extended and `type` for unions, intersections, and mapped types.
- Prefer `unknown` over `any` — it forces type narrowing before use and catches bugs at compile time.
- Avoid `any` — use `unknown` with type guards when the type is truly unknown.
- Use discriminated unions for state management over boolean flags.
- Prefer small, focused functions under 30 lines. Extract helpers when logic grows.
- Use `readonly` for arrays and properties that should not be mutated.
- Prefer explicit return types on exported functions for documentation and faster type-checking.
- Use `satisfies` operator for type validation without widening: `const config = { ... } satisfies Config`.
- Use template literal types for string pattern validation: `type Route = \`/${string}\``.
- If a function can fail, return a discriminated union (`{ ok: true; data: T } | { ok: false; error: E }`) instead of throwing — callers are forced to handle both cases.
- If a type is used across more than 2 files, move it to a shared `types/` directory. If it's only used locally, co-locate it.
- If you're unsure whether to use `interface` or `type`, prefer `interface` for object shapes (extendable) and `type` for unions, intersections, and computed types.
- Use `WeakMap`/`WeakSet` for caching references that should not prevent garbage collection.

### Bun Native APIs
- Use `Bun.file()` and `Bun.write()` for fast file I/O.
- Use `Bun.env` instead of `process.env` for type-safe env access.
- Use `bun install` with its lockfile (`bun.lockb`) — do not mix with npm/yarn/pnpm.
- Import `.toml`, `.txt`, `.json` files directly — Bun handles them natively.
- Use `Bun.password.hash()` / `Bun.password.verify()` instead of bcrypt.
- Use `Bun.spawn()` for subprocesses instead of `child_process`.
- Use `Bun.Transpiler` for runtime code transformation.
- Prefer Bun macros for compile-time code execution.
- If a Node.js API isn't yet supported in Bun, check the compatibility table before adding polyfills.
- If you need npm package compatibility, test with `bun install` first — most packages work out of the box.
- If performance is critical, benchmark Bun's native APIs vs Node.js equivalents with `bun:bench`.

### Airbnb JavaScript Style Guide
- For TypeScript: Use camelCase for variables, functions, properties, and method names.
- Enclose all strings in single quotes.
- Require semicolons to terminate statements.
- Declare variables with const by default; use let only for reassignment.
- Use strict equality (===) and strict inequality (!==).
- For TypeScript: Indent code blocks with exactly 2 spaces for consistent readability across teams.
- Limit lines to a maximum of 100 characters to facilitate code reviews and horizontal scrolling avoidance.
- Group and order import statements logically at file top (builtins, externals, internals) for clear dependency visualization.
- Choose descriptive, meaningful names for variables/functions to enhance self-documenting code and reduce comments need.
- Favor object destructuring in function parameters for cleaner, more readable signatures.
- For TypeScript: Avoid mutating function arguments; return new values instead to promote immutability and predictable behavior.
- Use ES6 default parameters (e.g., fn(param = default)) over || or && for falsy-safe defaults, handling edge cases like 0/false.
- Always brace block statements (if/else, loops) even for single lines to prevent scoping errors in minification/refactoring.
- Place function arguments on new lines after first when exceeding line length, aligning for multi-arg readability.
- No unused variables or imports; remove immediately to maintain clean, performant modules without dead code.

### Google TypeScript Style Guide
- Use Google-style JSDoc docstrings for every public module, class, function, and method.
- Annotate all functions, methods, class members, and variables with specific TypeScript types.
- Structure docstrings with Args, Returns, and Throws sections for parameters, return values, and exceptions.
- Use `interface` for object shapes and `type` for unions/aliases: `interface User { id: string; name: string }` vs `type Status = 'active' | 'inactive'`.
- Write `@param` and `@returns` JSDoc for all public APIs: `/** @param id - User identifier. @returns The user record or null if not found. */`.
- Annotate return types explicitly on public APIs: `async function fetchUser(id: string): Promise<User | null>` — never rely on inference for exported functions.
- Prefer `unknown` over `any`; narrow with type guards: `if (typeof val === 'string') { processString(val); }`.
- Include usage examples in docstrings where helpful, especially for complex public APIs.
- For asynchronous functions, document async behavior and potential rejection reasons in Throws.
- Align docstring formatting strictly with Google TypeScript Style Guide examples, using proper indentation and sections.

### Functional Patterns
- Prefer pure functions: given the same inputs, always return the same output with no side effects.
- Use immutable data structures; avoid mutating variables or objects after creation.
- Favor function composition and pipelines over deeply nested logic.
- Use higher-order functions (map, filter, reduce) instead of manual loops for collection transformations.
- Separate side effects (I/O, network, state) from pure computation; push effects to the edges of your program.
- Prefer declarative code that describes *what* to compute rather than *how* to compute it step by step.
- Use closures and partial application to create reusable, configurable function factories.
- Apply the principle of referential transparency: any expression can be replaced with its value without changing program behavior.
- Use algebraic data types (discriminated unions, tagged enums) to model domain states exhaustively and let the type system enforce correctness.
- Prefer recursion or fold-based iteration over mutable accumulators; use tail-call optimization where supported.
- Leverage pattern matching for branching logic instead of if-else chains or switch statements.
- Isolate stateful operations behind functional interfaces (e.g., monads, effect systems, or simple callback patterns) to keep the core logic testable.

## Linting & Formatting
### Prettier
- Run Prettier on save or pre-commit. Use `.prettierrc` for project-wide configuration.
- Let Prettier handle formatting — don't fight it. Focus code reviews on logic, not style.
- Configure `.prettierrc` and add `prettier --check .` to CI — use `lint-staged` with Husky for pre-commit formatting.
- Configure key options: `printWidth` (80-100), `tabWidth` (2), `singleQuote` (true/false), `trailingComma` ("all").
- Use `.prettierignore` to skip generated files, build output, and vendor directories.
- Integrate with ESLint using `eslint-config-prettier` to disable conflicting formatting rules.
- Run `prettier --check .` in CI to catch unformatted code before merge.
- Use `prettier --write .` for bulk formatting. Run once when adopting Prettier on an existing codebase.
- Use per-file overrides in `.prettierrc` for different settings on specific file types (e.g., wider `printWidth` for HTML).
- Use `// prettier-ignore` sparingly for hand-formatted code that Prettier breaks (complex objects, matrices).

### ESLint
- Use ESLint flat config (`eslint.config.js`). Extend recommended configs for your framework.
- Run `eslint --fix .` for auto-fixable issues. Run `eslint .` in CI without `--fix`.
- Use `typescript-eslint` with `strict` and `stylistic` configs — enable type-checked rules with `parserOptions.project` for deep type analysis.
- Use `@typescript-eslint/recommended` for TypeScript projects. Enable `strict` preset for stricter checks.
- Combine with Prettier: use `eslint-config-prettier` to disable formatting rules ESLint shouldn't handle.
- Configure `no-unused-vars`, `no-console`, `prefer-const` as errors — catch real issues, not style nits.
- Use `overrides` in flat config for different rules per file pattern (stricter for `src/`, relaxed for `tests/`).
- Use `eslint-plugin-import` for import ordering, no-circular-dependencies, and no-unresolved-imports.
- Use `--cache` flag for faster incremental runs in development.
- Write custom rules or use `no-restricted-syntax` for project-specific patterns to ban.

## Elysia
- For TypeScript: Define routes with `app.get('/users/:id', ({ params, set }) => { set.status = 200; return db.findUser(params.id) })` — use the destructured context object for params, body, query, set, and store.
- Use `t.Object({ id: t.String(), name: t.String() })` from `@elysiajs/typebox` to declare request/response schemas — Elysia infers TypeScript types and performs runtime validation automatically.
- Group related routes with `new Elysia({ prefix: '/api' }).get('/users', ...).post('/users', ...)` and compose with `app.use(usersPlugin)`.
- Use `new Elysia().derive(({ request }) => ({ userId: verifyToken(request.headers.get('authorization')) }))` to inject derived context shared across scoped routes.
- Connect to Eden Treaty with `const api = treaty<App>('http://localhost:3000')` for fully typed client calls with no code generation.
- For TypeScript: Define typed routes: `app.post('/users', ({ body, set }) => { const user = createUser(body); set.status = 201; return user }, { body: t.Object({ name: t.String(), email: t.String({ format: 'email' }) }), response: UserSchema })` — Elysia validates body and response at runtime and infers TypeScript types.
- Group routes into Elysia plugins: `const usersPlugin = new Elysia({ prefix: '/users' }).get('/', listUsers).post('/', createUser, { body: CreateUserDto })` and mount with `app.use(usersPlugin)`.
- Use `onError` hook for centralized error handling: `app.onError(({ code, error, set }) => { set.status = code === 'NOT_FOUND' ? 404 : 500; return { error: error.message } })`.
- Inject shared context with `.derive()`: `new Elysia().derive(async ({ request, cookie }) => { const user = await verifyJWT(cookie.token.value); if (!user) throw new Error('Unauthorized'); return { user } })` — derived values are available in all downstream route handlers.
- Use `app.guard({ beforeHandle: authMiddleware })` to apply middleware to a group of routes without repeating it on every handler.
- For TypeScript: Declare route schemas inline for full type inference: `app.put('/posts/:id', ({ params, body }) => updatePost(params.id, body), { params: t.Object({ id: t.String() }), body: t.Object({ title: t.Optional(t.String()), content: t.Optional(t.String()) }), response: PostSchema })` — do not use runtime casts; let Elysia's typebox schemas drive both validation and types.
- Group routes with `new Elysia({ prefix: '/api/v1' })` plugins and compose plugins with `app.use(authPlugin).use(usersPlugin).use(postsPlugin)` — each plugin is independently testable.
- Derive request-scoped values once: `const authPlugin = new Elysia().derive(async ({ cookie }) => { const user = await verifyToken(cookie.session.value); if (!user) throw new AuthError(); return { user } })` — downstream handlers receive `user` without repetition.
- Apply guards to route groups: `new Elysia().use(authPlugin).guard({ beforeHandle: ({ user }) => { if (!user.isAdmin) throw new ForbiddenError() } }, (app) => app.delete('/admin/users/:id', deleteUser))`.
- Handle errors with lifecycle hooks: `app.onError(({ code, error, set }) => { if (error instanceof ValidationError) { set.status = 422; return { errors: error.all } } set.status = 500; return { error: 'Internal Server Error' } })`.
- Access cookies with `cookie.session.value` and set them with `cookie.session.set({ value: token, httpOnly: true, secure: true, maxAge: 86400 })` — never read `Set-Cookie` headers manually.
- Connect the Eden Treaty client: `const api = treaty<typeof app>('http://localhost:3000'); const { data, error } = await api.users({ id: '1' }).get()` — the client types are derived directly from the Elysia app type.
- Use `app.listen(3000, ({ hostname, port }) => console.log('Listening on', hostname, port))` — Elysia runs on Bun's built-in HTTP server for maximum throughput.
- Write tests with Elysia's test client: `const app = new Elysia().get('/ping', 'pong'); const response = await app.handle(new Request('http://localhost/ping')); expect(response.status).toBe(200)`.

## Architecture
### API Architecture
- Use consistent URL patterns: plural nouns for resources, nested routes for relationships. Avoid verbs in URLs.
- Return proper HTTP status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Server Error.
- Version your API from day one. Use URL prefix (/v1/) or Accept header versioning.
- Validate all request bodies and query parameters at the boundary. Return structured error responses with error codes.
- Implement pagination for all list endpoints: cursor-based (preferred) or offset-based. Include total count and next/prev links.
- Use consistent error response format: { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }.
- Add rate limiting with clear headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
- Support filtering, sorting, and field selection on list endpoints. Use query params: ?sort=-created_at&fields=id,name.
- Use ETags or Last-Modified for caching. Return 304 Not Modified when the resource has not changed.
- Implement health check endpoints: /health for basic liveness, /ready for dependency checks (DB, cache, external APIs).
- Use API documentation (OpenAPI/Swagger) as the source of truth. Generate client SDKs and server stubs from the spec.
- Implement graceful degradation: when a non-critical dependency fails, return partial results with a warning header.
- Support bulk operations for endpoints that users frequently call in loops. Batch create/update/delete saves round trips.
- Use webhooks for push notifications instead of polling. Include HMAC signatures for webhook payload verification.
- Implement request/response compression (gzip, brotli) for payloads over 1KB. Respect Accept-Encoding headers.
- Add audit logging for all write operations. Track who changed what, when, and from which IP/client.

### Modular Architecture
- Keep modules small, focused, and decoupled. Each module should have a single clear responsibility.
- Define explicit public interfaces — hide implementation details behind well-defined boundaries.
- Define clear module boundaries with explicit public APIs — modules communicate through interfaces, not direct imports of internal classes.
- Use dependency injection to manage dependencies between modules — never hardcode concrete implementations.
- Enforce unidirectional dependencies. If A depends on B, B must never depend on A.
- Group related functionality into cohesive packages. A module should change for one reason only.
- Expose the minimum public API surface — internal implementation details should stay internal.
- Use barrel files or explicit re-exports to control what each module exposes.
- Define module boundaries by domain or feature, not by technical layer.
- Write integration tests at module boundaries to verify contracts between modules.
- Audit dependency graphs regularly — tools like `madge`, `deptree`, or IDE dependency analysis catch creeping coupling.
- Use interface segregation: define small, focused interfaces rather than large ones that force consumers to depend on methods they don't use.

## Performance
### TypeScript Performance
- Use `for` loops or `for...of` instead of `forEach` or `map` in hot code paths for better performance.
- Avoid unnecessary object allocations inside loops to reduce garbage collection pressure.
- Use `Map` and `Set` for frequent insertions, deletions, and keyed sideups instead of plain objects or arrays.
- Cache results of expensive computations manually or use memoization techniques.
- Avoid synchronous blocking I/O methods; always use async/await equivalents.
- Debounce or throttle high-frequency events to prevent CPU spikes.
- Use `structuredClone` for deep copying instead of `JSON.parse(JSON.stringify())`.
- Leverage Web Workers or `worker_threads` for CPU-intensive tasks to avoid completely blocking the main thread event loop.
- Use pre-allocated typed arrays (`Uint8Array`, `Float64Array`) when processing large streams of numerical or binary data.
- Profile memory usage with DevTools or Inspector to detect and fix memory leaks (e.g. uncleared intervals, lingering closures).
- Optimize imports by avoiding wildcard imports (`import * as _`) and only importing needed utilities to keep bundle sizes small.
- Yield back to the main thread during heavy synchronous processing using macrotasks.

## Security
### Security Guidelines
- Validate and sanitize all user inputs from external sources.
- NEVER hardcode secrets (API keys, passwords) in the codebase. Use environment variables.
- Use parameterized queries for all database access — never concatenate user input into SQL, command strings, or template expressions.
- If you detect a hardcoded secret, stop immediately and prompt the user to remove it.
- Use parameterized queries or ORMs to prevent SQL injection.
- Ensure code handles edge cases and failures gracefully, not just the happy path.
- If accepting file uploads, validate MIME type, size, and filename — never trust client-supplied content types.
- If using environment variables for secrets, ensure they're not logged, serialized, or exposed in error messages.
- If a route handles sensitive operations (password change, payment), require re-authentication or CSRF tokens.
- If rate limiting is needed, implement it at the API gateway or reverse proxy level — not in application code alone.
- Keep dependencies up to date and scan for known vulnerabilities in CI — treat high-severity CVEs as release blockers and patch them before deploying to production.

## Testing
### bun:test Patterns
- Use `expect()` matchers from Bun's built-in test API.
- Use `bun:bench` for performance benchmarking alongside tests.
- Use `--coverage` flag with `bun test` for code coverage reports.
- If you need snapshot testing, use Bun's built-in `toMatchSnapshot()` — no additional setup needed.

## Libraries & Tools
### Zod
- Define schemas with `z.object({})` for validation — use `z.infer<typeof schema>` to derive TypeScript types from schemas.
- Validate at system boundaries: API inputs, form data, environment variables, config files — fail fast with descriptive error messages.
- Use `z.enum()` for string literals, `z.discriminatedUnion()` for tagged unions, `z.transform()` for parsing and coercion.
- Use `.parse()` to throw on invalid data, `.safeParse()` to get a Result-like `{ success, data, error }`.
- Compose schemas: use `.extend()`, `.merge()`, `.pick()`, `.omit()` to build variants from base schemas.
- Use `.transform()` for coercion and normalization (trimming strings, parsing dates).
- Define shared schemas in a central file and import them across API routes and client code.
- Use `z.discriminatedUnion()` for tagged union validation — it produces better error messages than `z.union()`.
- Use `z.preprocess()` for coercing query string values (string → number, string → boolean).

### Prisma
- Define models in `schema.prisma`. Use `prisma migrate dev` for development, `prisma migrate deploy` for production.
- Use Prisma Client for all database queries — never write raw SQL unless absolutely necessary.
- Use `prisma.$transaction()` for multi-step operations that must succeed or fail atomically — prevents partial data corruption.
- Use `include` and `select` to control query shape — avoid over-fetching related data.
- Use transactions (`prisma.$transaction`) for multi-step operations that must be atomic.
- Use `@unique`, `@index`, and `@@index` for query performance. Add indexes for frequently filtered columns.
- Use `prisma generate` after schema changes to update the TypeScript client types.
- Use Prisma's relation queries (`connect`, `create`, `connectOrCreate`) for type-safe nested writes.
- Use `findUniqueOrThrow` / `findFirstOrThrow` when the record must exist — avoid manual null checks.
- Use middleware (`prisma.$use`) for cross-cutting concerns like soft deletes or audit logging.
- Use raw queries (`$queryRaw`, `$executeRaw`) only for complex aggregations or DB-specific features.
- Seed data with `prisma db seed` — keep seeds idempotent with upserts.

## Agent Workflow
### Planning & Task Execution
- Always plan before coding — break complex tasks into small, verifiable steps before writing code.
- After each step, verify the result works (run tests, check output) before moving to the next.
- Break tasks into verifiable subtasks — each subtask should produce a testable output that can be validated before proceeding.
- Decompose large tasks into subtasks of 1–3 files each — smaller scope means fewer errors.
- State assumptions explicitly before starting — verify them with the user if uncertain.
- When exploring unfamiliar code, read tests first — they document intended behavior.
- If a task requires more than 5–7 steps, propose a plan to the user before starting execution.
- If you encounter an unfamiliar codebase, map the dependency graph (imports, calls) before making changes.
- If the user's request is ambiguous, ask one clarifying question rather than guessing — wrong assumptions waste more time than a quick question.
- Re-read relevant files before making changes — don't rely on stale context from earlier in the conversation.
- After completing a feature, review your own changes as if you were a code reviewer — check for missed edge cases, unused imports, and consistency with surrounding code.

### Subagent Strategy
- Use subagents liberally to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- Use subagents liberally to keep the main context window clean and focused on the active task.
- For complex problems, throw more compute at it via subagents rather than loading everything into one context.
- Keep one task per subagent for focused execution.
- Treat subagents as a core tool for context management: offload research, file exploration, and parallel analysis to dedicated subagents rather than polluting the main context window.
- For complex problems, decompose into parallel subagent tasks — exploring a codebase, researching patterns, and drafting a plan can all happen in parallel.
- One task per subagent for focused execution: a subagent that does multiple unrelated things produces lower-quality results and harder-to-audit work.
- Use the main agent as an orchestrator that synthesizes subagent results, not as the executor of every granular step.
- When a subagent returns results, critically evaluate them before incorporating — do not blindly trust delegated work.

### Verification Before Done
- Never mark a task complete without proving it works.
- Run tests, check logs, and demonstrate correctness before declaring done.
- Never mark a task complete without proving it works — run tests, check logs, and demonstrate the expected behavior.
- Diff behavior between main and your changes when relevant to catch regressions.
- Ask yourself: "Would a staff engineer approve this?" before marking anything done.
- Verification is part of the task, not optional cleanup.
- Never mark a task complete without concrete proof it works: run the relevant tests, check application logs, and demonstrate the expected behavior end-to-end.
- Diff behavior between main and your changes when relevant — identify regressions, not just new functionality working correctly.
- Apply the staff engineer standard: before marking anything done, ask "Would a staff engineer approve this?" If the answer is "probably not," keep working.
- Verification is part of the task definition, not an optional post-step. A feature that works but has untested edge cases or unverified integration points is not done.
- For bug fixes specifically: reproduce the bug first, fix it, then confirm the reproduction case no longer triggers. Document the verification steps.
- **MANDATORY**: Always run `bun check` from the repository root after any changes. This ensures both frontend and backend pass linting, formatting, and type checking before marking work complete.

### Demand Elegance
- For non-trivial changes, pause and ask "is there a more elegant way?"
- If a fix feels hacky, implement the elegant solution instead.
- For non-trivial changes, pause and ask "is there a more elegant way?" before implementing.
- If a fix feels hacky, stop and say: "Knowing everything I know now, implement the elegant solution."
- Skip this for simple, obvious fixes — don't over-engineer.
- Challenge your own work before presenting it to the user.
- Before implementing any non-trivial change, pause and ask: "Is there a more elegant way?" Elegance means simpler, more maintainable, and less surprising — not clever or complex.
- When a fix feels hacky or requires working around the system, treat that feeling as a signal. Stop and reframe: "Knowing everything I know now, what is the elegant solution?"
- Skip elegance checks for simple, obvious fixes — not every one-liner needs philosophical reflection. Reserve this for architectural choices, significant refactors, or any change touching core abstractions.
- Challenge your own work before presenting it: review what you built with a critical eye. Would you be comfortable explaining every decision in a code review?
- Elegance is not perfection. The goal is the minimum complexity needed for the task — three clear lines of code beat an abstraction that will be used once.

### Core Principles
- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary.
- **Simplicity First**: Make every change as simple as possible. The minimum complexity that solves the problem is the right amount.
- **No Laziness**: Find root causes, not symptoms. No temporary fixes or workarounds. Apply senior developer standards to every change.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs in adjacent code by limiting scope.
- **Simplicity First**: Every change should be as simple as possible while fully solving the problem. Complexity should be earned, not assumed — three clear lines beat a clever abstraction.
- **No Laziness**: When a bug is found, find its root cause — not its symptom. Temporary fixes and workarounds compound technical debt. Apply senior developer standards: what would you be proud to have in a code review?
- **Minimal Impact**: Changes should only touch what is strictly necessary for the task. Unnecessary edits to adjacent code introduce risk without benefit and make diffs harder to review.
- Avoid over-engineering: don't add features, refactor code, or make "improvements" beyond what was asked. A bug fix doesn't need surrounding code cleaned up.
- Trust internal guarantees: don't add error handling or validation for scenarios that can't happen. Validate at system boundaries (user input, external APIs), not internally.
- Challenge every addition: before adding code, ask "is this actually needed?" Prefer deletion and simplification over addition when both solve the problem.

## React
- Define a `Props` interface for every component and type the function signature: `function Button({ label, onClick }: Props)`.
- Use generic hooks for type safety: `useState<User | null>(null)`, `useRef<HTMLInputElement>(null)`, `useReducer<Reducer<State, Action>>`.
- Type event handlers explicitly: `React.MouseEvent<HTMLButtonElement>`, `React.ChangeEvent<HTMLInputElement>`, `React.FormEvent<HTMLFormElement>`.
- Use `React.FC` sparingly — prefer explicit return types: `function Card({ title }: Props): React.ReactElement`. Use generic components: `function List<T>({ items, renderItem }: ListProps<T>)`.
- Prefer `interface Props` over `React.FC<Props>` — define props as an interface and use a regular function declaration for components.
- Use `React.ComponentPropsWithoutRef<'button'>` to extend native HTML element props when wrapping built-in elements.
- Type children explicitly: use `React.ReactNode` for renderable content, `React.ReactElement` when only JSX elements are accepted.
- Create typed context with a factory: `createContext<ContextType | null>(null)` and a custom hook that throws if used outside the provider.
- Use discriminated unions for component variants: `type Props = { variant: 'link'; href: string } | { variant: 'button'; onClick: () => void }`.
- Type custom hooks with explicit return types: `function useAuth(): { user: User | null; login: (creds: Credentials) => Promise<void> }`.
- Use `React.forwardRef<HTMLInputElement, InputProps>` with generic type parameters for components that expose DOM refs.
- Prefer `satisfies` for constant config objects to get both type checking and narrow literal types: `const routes = { ... } satisfies Record<string, Route>`.
- Type render props and children-as-function patterns with explicit callback signatures: `children: (data: T) => React.ReactNode`.
- Use generic components for reusable lists and selects: `function Select<T extends { id: string }>({ items, onSelect }: SelectProps<T>)`.

### TanStack Query
- Invalidate related queries after mutations with `queryClient.invalidateQueries({ queryKey: [...] })`.
- Set `staleTime` per query based on data volatility — `Infinity` for static data, short durations for frequently changing data.
- Structure query keys hierarchically: `["users"]`, `["users", userId]`, `["users", userId, "posts"]`.
- Use `queryFn` to wrap your API client — keep TanStack Query as the caching layer, not the fetcher.
- Use `staleTime` to control refetch frequency. Set app-wide defaults in `QueryClient`.
- Use `enabled` option to conditionally disable queries (e.g., wait for auth, dependent queries).
- Use `useInfiniteQuery` for paginated/infinite scroll data with `getNextPageParam`.
- Use `useMutation` with `onSuccess` to invalidate or optimistically update related queries.
- Use `placeholderData` for instant UI transitions while fresh data loads.
- Use `queryClient.prefetchQuery` in route loaders for instant page transitions.
- Colocate query hooks with the components that use them — create custom hooks like `useUser(id)`.
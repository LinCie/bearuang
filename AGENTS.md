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

- **Framework**: React 19 + TanStack Router
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

### Codebase Exploration
- **MUST use `serena` MCP for all code exploration** — never use `read`, `grep`, or `glob` as your first approach to exploring code. Serena provides symbol-level intelligence that basic text search cannot match.
- **MUST first activate the project** using `serena_activate_project` with `project: "bearuang"` or the absolute path `/home/hebot/bearuang` before using any serena tools.
- Use `serena_find_symbol` for locating specific functions, classes, or variables by name path pattern.
- Use `serena_find_referencing_symbols` to find all usages of a symbol across the codebase.
- Use `serena_get_symbols_overview` to understand the structure of a file before diving in.
- Use `serena_search_for_pattern` for content search when you need regex-style pattern matching.
- **Check `serena_read_memory` at the start of each session** for project-specific patterns, conventions, and cross-module knowledge that has been previously captured. Use `serena_write_memory` to persist important findings (module patterns, dependency rules, coding conventions) at the end of a productive session.
- Only fall back to `read`, `grep`, and `glob` when serena is unavailable or returns insufficient results — document why when doing so.

### Code Modification
- **MUST use serena write tools for all code modifications** — they understand code structure and update references automatically, unlike text-based `edit`/`write` tools.
- Use `serena_replace_content` for inline content changes with regex precision.
- Use `serena_replace_symbol_body` to replace a function/class body while preserving its signature and references.
- Use `serena_insert_after_symbol` / `serena_insert_before_symbol` to add new symbols relative to existing ones.
- Use `serena_rename_symbol` to rename a symbol across the entire codebase in one pass.
- Use `serena_safe_delete_symbol` to delete a symbol only when it has no references.
- Only fall back to basic `edit`/`write` tools when serena is unavailable or for non-code files.

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
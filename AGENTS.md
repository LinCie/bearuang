# AGENTS.md

This document provides essential information for agentic coding agents working in the BearUang repository.

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

## Environment Variables

### Backend (`packages/backend/.env.local`)

- `DATABASE_URL` - PostgreSQL connection string
- Additional better-auth configuration as needed

### Frontend (`packages/frontend/.env.local`)

- `PUBLIC_BACKEND_URL` - Backend API URL (defaults to `http://localhost:8000`)

## Code Style Guidelines

### Imports

- **Path aliases**: Use `@/*` or `#/*` for imports from `src/`
  ```typescript
  import { Button } from "@/components/ui/button"; // route files
  import { cn } from "#/lib/utils"; // ui components
  import { authClient } from "@/lib/auth-client";
  import type { App } from "backend/src/index"; // workspace imports
  ```
- **Order**: External packages first, then internal modules, then relative imports
- **Quotes**: Single quotes for strings (Prettier enforced)
- **File extensions**: Omit `.ts`/`.tsx` extensions in imports (except URLs like `?url`)
- **Import sorting**: Not enforced by ESLint (sort-imports and import/order are off)

### TypeScript

- **Strict mode**: Enabled for both backend and frontend
- **noUnusedLocals / noUnusedParameters**: Enabled on frontend
- **verbatimModuleSyntax**: Enabled on frontend (use `import type` for type-only imports)
- **Type exports**: Use `export type` for type-only exports
  ```typescript
  export type App = typeof app;
  ```

### Formatting (Prettier)

- **No semicolons**
- **Single quotes**
- **Trailing commas**: Always (including function arguments)
- **Indentation**: 2 spaces

### Naming Conventions

- **Files**: camelCase (`.ts`, `.tsx`) or kebab-case for route files
  - `auth-client.ts`, `utils.ts` - libraries
  - `button.tsx`, `input.tsx` - UI components
  - `auth-layout.tsx` - layout components
  - `signin.tsx`, `signup.tsx` - route files
- **Variables**: camelCase
- **Types/Interfaces**: PascalCase
- **React components**: PascalCase function declarations
  ```typescript
  function SigninPage() { ... }  // not const SigninPage = () => {}
  function Button({ ... }) { ... }  // ui components
  ```

### Frontend Patterns

#### Routing (TanStack Router)

- File-based routing in `src/routes/`
- `__root.tsx` defines the HTML shell via `shellComponent`
- Routes export a `Route` constant created with `createFileRoute('/path')`
- Navigation: `router.navigate({ to: '/path' })` or `<Link to="/path">`

#### Components

- **UI components** (`src/components/ui/`): shadcn/ui primitives using Radix, CVA for variants, `cn()` for class merging
  - Use `data-slot` attributes for targeting in styles
  - Function components (not arrow functions)
  - Named exports (e.g., `export { Button }`)
- **Layout components** (`src/components/layouts/`): Page-level composition wrappers
- Import from `@/components/...` in route files, `#/components/...` in ui files

#### Forms (TanStack Form)

- `useForm()` with `defaultValues` and `onSubmit`
- Field-level validation via `validators: { onBlur: schema, onSubmit: schema }`
- Use `<form.Field name="...">` render prop pattern
- Use `<form.Subscribe selector={...}>` for reactive form state

#### Auth (better-auth client)

- Import pre-exported hooks from `@/lib/auth-client`:
  ```typescript
  import {
    signIn,
    signOut,
    signUp,
    useSession,
    useActiveOrganization,
  } from "@/lib/auth-client";
  ```
- Backend URL configured via `PUBLIC_BACKEND_URL` env var

#### Styling

- Tailwind CSS 4 with shadcn theme variables (oklch color space)
- Dark mode: `.dark` class on parent element
- Font: Roboto Variable (sans-serif)
- Base color theme: olive
- Use semantic tokens: `bg-background`, `text-foreground`, `bg-primary`, etc.
- Never edit `src/styles.css` theme variables unless adding new tokens
- shadcn/ui components use `#` path alias for internal imports

### Error Handling

- **Frontend forms**: Catch auth errors and display via local state
  ```typescript
  const [serverError, setServerError] = useState<string | null>(null)
  const { error } = await signIn.email({ ... })
  if (error) { setServerError(error.message ?? 'fallback message'); return }
  ```
- **Backend**: Use `.onError()` hook at app level, return `status(code)` for HTTP errors
- **Logging**: Use pino logger on backend

### Testing

- **Framework**: Vitest + jsdom
- **Libraries**: @testing-library/react, @testing-library/dom
- **Place tests**: Alongside source files as `*.test.ts` or `*.test.tsx`
- **Run all**: `bun run test` (equivalent to `vitest run`)
- **Run single file**: `bun vitest run src/path/to/file.test.ts`
- **Run by name**: `bun vitest run -t "test name pattern"`
- **Watch mode**: `bun vitest` (no `run` flag)

## Important Notes

- **Auto-generated files**: Never edit `src/routeTree.gen.ts` (frontend), `src/generated/` (backend)
- **Environment files**: Use `.env.local` for local development
- **Generated code**: Never commit Prisma generated client
- **shadcn/ui**: Use radix-vega style, olive base color, Roboto Variable font
- **Package manager**: Bun for backend and frontend
- **ESLint overrides**: import ordering, import cycle, and require-await are disabled
- **Language**: UI text is in Indonesian (Bahasa Indonesia) - maintain this convention for user-facing strings

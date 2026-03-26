# Tech Stack

The project is a monorepo managed with **Bun**.

## Root
- **Runtime**: Bun
- **Package Manager**: Bun Workspaces

## Backend (`packages/backend`)
- **Framework**: ElysiaJS
- **ORM**: Prisma (PostgreSQL)
- **Authentication**: Better Auth
- **Validation**: Zod
- **Logging**: Pino
- **API Documentation**: OpenAPI (Swagger) via `@elysiajs/openapi`

## Frontend (`packages/frontend`)
- **Framework**: React 19 (TypeScript)
- **Build Tool**: Vite
- **Routing**: TanStack Router
- **State Management**: TanStack Query
- **Form Management**: TanStack Form
- **Table Management**: TanStack Table
- **Framework integration**: TanStack Start
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **UI Components**: Shadcn, Radix UI

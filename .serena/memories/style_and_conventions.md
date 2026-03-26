# Code Style and Conventions

## Frontend
- **Formatting**: Prettier with `semi: false`, `singleQuote: true`, `trailingComma: 'all'`.
- **Linting**: ESLint using `@tanstack/eslint-config`.
- **Typing**: Strict TypeScript.

## Backend
- **Formatting**: Default Prettier (`semi: true`, double quotes).
- **Architecture**: Domain-driven structure in `src/modules/` (e.g., `products`, `members`, etc.).
- **Logging**: Use `logger` from `@/libraries/utilities`.

## Database
- **Primary Keys**: Uses UUIDv7 for most tables (e.g., `Product`, `ProductVariant`, `Warehouse`, `StockMovement`, `Supplier`, `Customer`, `PurchaseOrder`, `SalesOrder`).
- **Naming**: Table names are lowercase and snake_case in the database (e.g., `@@map("user")`), but PascalCase in Prisma models.

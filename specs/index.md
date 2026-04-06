# BearUang Specifications

Complete specification index for all feature modules in the BearUang monorepo.

## Feature Modules

| Module | Spec | Description |
|--------|------|-------------|
| [Products](./products/spec-v1.md) | v1 | Products, Variants & Product Categories — CRUD with images, soft-delete, hierarchical categories |
| [Auth](./auth/spec-v1.md) | v1 | Authentication & Authorization — better-auth, sessions, API keys, RBAC, organizations |
| [Permissions](./permissions/spec-v1.md) | v1 | RBAC Permissions — 16-resource permission model, role definitions, introspection API |
| [Roles](./roles/spec-v1.md) | v1 | Custom Roles — Dynamic RBAC roles with permission arrays, system role protection |
| [Members](./members/spec-v1.md) | v1 | Organization Members — Member listing, role management, removal |
| [Invitations](./invitations/spec-v1.md) | v1 | Organization Invitations — Invite, accept, reject, cancel workflow |
| [API Keys](./api-keys/spec-v1.md) | v1 | API Key Management — Key creation with permissions, expiry, enable/disable |
| [Warehouses](./warehouses/spec-v1.md) | v1 | Warehouse Locations — CRUD for warehouse management |
| [Stock Movements](./stock-movements/spec-v1.md) | v1 | Stock Movements — IN/OUT/ADJUSTMENT records, single writer for variant stock |
| [Suppliers](./suppliers/spec-v1.md) | v1 | Supplier Records — CRUD with contact fields, active filter |
| [Customers](./customers/spec-v1.md) | v1 | Customer Records — CRUD with offline sync support |
| [Purchase Orders](./purchase-orders/spec-v1.md) | v1 | Purchase Orders — Full lifecycle state machine, items, payment tracking |
| [Sales Orders](./sales-orders/spec-v1.md) | v1 | Sales Orders — Full lifecycle state machine, guest orders, offline support |
| [Dashboard](./dashboard/spec-v1.md) | v1 | Dashboard — Summary metrics, verdicts, recent orders, reports |
| [Uploads](./uploads/spec-v1.md) | v1 | File Uploads — S3 presigned URLs, media management, multi-file upload |
| [Audit](./audit/spec-v1.md) | v1 | Audit Logging — Fire-and-forget audit trail, cross-module dependency |
| [Sync](./sync/spec-v1.md) | v1 | Offline Sync — Initial/delta sync, batch mutations, conflict detection |
| [POS](./pos/spec-v1.md) | v1 | Point of Sale — Offline-capable cart, checkout, receipt generation |
| [Offline-First](./offline-first/spec-v1.md) | v1 | Offline-First Architecture — Service Worker, Dexie, mutation queue |
| [Offline-First](./offline-first/spec-v2.md) | v2 | Offline Auth Persistence — TanStack Query persist, dual-fetch elimination, offline-safe route guards |
| [AI Assistant](./ai/spec-v1.md) | v1 | AI Assistant — Natural language interface for products with OpenAI-compatible tool calling, RBAC, write confirmation |

## Cross-Module Dependencies

```
auth ─────────────────────────────────────────────────────────────┐
  │                                                               │
  ├── permissions ──── roles ──── members ──── invitations        │
  │                         │                                     │
  │                         └─── api-keys                         │
  │                                                               │
  ├── products ──── product-categories (covered in products spec) │
  │     │                                                         │
  │     ├── variants ──── stock-movements                         │
  │     │                   │                                     │
  │     │                   ├── purchase-orders ──── suppliers     │
  │     │                   └── sales-orders ────── customers     │
  │     │                                                         │
  │     └── uploads (images)                                      │
  │                                                               │
  ├── warehouses                                                 │
  │                                                               │
  ├── dashboard                                                   │
  │                                                               │
  └── audit (universal dependency)                                │
      └── All write modules log to audit                          │
                                                                  │
sync ──── offline-first (architecture)                            │
  │                                                               │
  ├── products, variants, categories, customers,                  │
  │   warehouses, suppliers (initial/delta sync)                  │
  │                                                               │
  └── sales-orders, customers (batch mutations)                   │
                                                                  │
pos ──── sales-orders, products/variants, customers, warehouses   │
        └── Uses offline sync infrastructure                      │
                                                                  │
ai ──── products (tools), product-categories (tools)              │
        ├── permissions (RBAC per tool)                           │
        └── llm integration (reusable, env-configured)            │
```

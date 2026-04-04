---
title: Uploads Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: uploads
tags: [uploads, media, s3, presigned-url, elysia, prisma, react, tanstack, dnd-kit]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the uploads domain in BearUang. It covers the **Media** resource and the S3 presigned URL upload flow that enables client-side direct uploads to object storage. The upload components (`MultiFileUpload`, `FileUpload`) are consumed by the products module for product and variant images, and are designed as reusable building blocks for any future feature requiring file uploads.

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugin, service layer, Prisma model, and S3 integration
- **Frontend module structure**: TanStack Query hooks (`useUpload`, `useMedia`), React components (`FileUpload`, `MultiFileUpload`), and drag-and-drop reordering
- **API contracts**: HTTP endpoints (presign, confirm, list, get, delete), request/response schemas, error handling
- **Upload lifecycle**: Presign request -> client-side S3 PUT -> confirm upload -> media record with public URL
- **Conventions**: file naming, code organization, permission model, image compression, progress tracking

**Audience**: Developers building new modules that require file uploads, or modifying the uploads domain.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, AWS SDK v3 (S3 presigned URLs), @dnd-kit for drag-and-drop, and shadcn/ui.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Media** | A database record representing a file stored in S3-compatible object storage, with metadata (filename, content type, size, purpose, S3 key) |
| **Presigned URL** | A time-limited S3 URL (15-minute expiry) that allows the client to upload directly to S3 without proxying through the backend |
| **Upload Lifecycle** | The three-step flow: presign (get URL + create DB record) -> client PUT (upload file to S3) -> confirm (verify and get public URL) |
| **Purpose** | An optional string tag on a media record used for categorization (e.g., `product-image`, `avatar`, `attachment`) and S3 key prefixing |
| **S3 Key** | The full object path in S3: `{organizationId}/{purpose}/{uuid}.{ext}` |
| **Pending Image** | A file selected by the user that is currently uploading, completed, or in error state — not yet persisted as a product/variant image |
| **Existing Image** | An image already persisted on the server (referenced via `ProductImage` or `VariantImage` junction records) |
| **Image Compression** | Client-side compression of image files via `browser-image-compression` before upload, reducing bandwidth and storage costs |
| **Route Plugin** | An Elysia plugin that defines all HTTP endpoints for a resource (`uploads.route.ts`) |
| **Service** | An object literal containing business logic and Prisma queries (`uploads.service.ts`) |
| **Serialize** | Converting Prisma Date types to JSON-safe ISO strings and appending the S3 public URL before API response |
| **Eden Treaty** | Type-safe API client from `@elysiajs/eden` that infers types from the Elysia app |
| **UUID v7** | Time-sortable UUID generated via `dbgenerated("uuidv7()")`; note that Media uses `uuid()` (v4) for the primary key, while S3 key segments use `crypto.randomUUID()` |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: The uploads module resides in `packages/backend/src/modules/uploads/` with `.route.ts`, `.service.ts`, and `.test.ts` files
- **REQ-002**: Route plugin is an Elysia instance with `{ prefix: '/uploads', tags: ['Uploads'] }`
- **REQ-003**: All route plugins must use `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: Every endpoint must declare `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Permissions are declared per-endpoint as `requirePermission: { media: ['action'] }` where actions are `view`, `create`, `delete`
- **REQ-006**: Zod schemas define request validation (body, query, params) and response shapes
- **REQ-007**: Zod response schemas use `z.iso.datetime()` for all Date fields (ISO 8601 strings)
- **REQ-008**: `serializeMedia` converts Prisma Date types to ISO strings and appends the public URL via `getPublicUrl(key)` before returning to client
- **REQ-009**: All Prisma queries are scoped by `organizationId`
- **REQ-010**: All write operations call `void logAudit(...)` with `model: 'Media'`, operation, `args`, `organizationId`, `userId`, `authType`
- **REQ-011**: OpenAPI `detail` objects with `summary` and `description` must be defined on every endpoint
- **REQ-012**: Not-found scenarios return `404` with `{ message: string }`
- **REQ-013**: The `MAX_FILE_SIZE` constant is `50 * 1024 * 1024` (50 MB) and is enforced both in Zod validation (`.max(MAX_FILE_SIZE)`) and in the service layer

### 3.2 Service Layer

- **REQ-014**: Service is exported as an object literal: `export const uploadsService = { async method() {...} }`
- **REQ-015**: `presignUpload` creates a Media DB record first, then generates the presigned PUT URL — ensuring the key is reserved even if the upload fails
- **REQ-016**: S3 keys follow the pattern `{organizationId}/{purpose ?? 'uploads'}/{crypto.randomUUID()}.{ext}`
- **REQ-017**: `confirmUpload` verifies the media record exists and belongs to the organization before returning the full serialized record
- **REQ-018**: `listMedia` uses `prisma.$transaction([findMany, count])` to return `{ data, total }` with optional `purpose` filtering
- **REQ-019**: `deleteMedia` removes the S3 object first, then deletes the database record — ensuring storage is cleaned up on success
- **REQ-020**: The Media model does **not** support soft delete — deletion is permanent (both DB record and S3 object are removed)

### 3.3 S3 Integration

- **REQ-021**: S3 client is configured via environment variables: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL`
- **REQ-022**: `forcePathStyle: true` is enabled for compatibility with S3-compatible services (e.g., MinIO, Cloudflare R2)
- **REQ-023**: Presigned PUT URLs expire after 900 seconds (15 minutes) via `{ expiresIn: 900 }`
- **REQ-024**: `getPublicUrl(key)` constructs the public URL as `${S3_PUBLIC_URL}/${key}`
- **REQ-025**: `deleteObject(key)` sends a `DeleteObjectCommand` to remove the file from S3

### 3.4 Frontend Architecture

- **REQ-026**: The uploads module resides in `packages/frontend/src/modules/uploads/` with `hooks/`, `components/`, and `index.ts`
- **REQ-027**: TanStack Query hooks wrap Eden Treaty API calls in `hooks/use-upload.ts` and `hooks/use-media.ts`
- **REQ-028**: Query key factories are defined in `hooks/use-media.ts` as `mediaKeys` hierarchical objects
- **REQ-029**: `useUpload` manages local state (`media`, `error`, `isUploading`, `progress`) and performs the three-step upload lifecycle
- **REQ-030**: Image files are compressed client-side via `browser-image-compression` with default settings (max 1920px, 80% quality, Web Worker)
- **REQ-031**: `FileUpload` is a single-file dropzone component with drag-and-drop support, preview, and progress bar
- **REQ-032**: `MultiFileUpload` is a multi-file uploader with drag-and-drop reordering (via `@dnd-kit`), existing image management, pending upload tracking, retry on error, and file count limit
- **REQ-033**: Cache invalidation targets `mediaKeys.lists()` after successful uploads
- **REQ-034**: All UI text is in Indonesian (Bahasa Indonesia)

### 3.5 Database

- **REQ-035**: Media uses `uuid()` (v4) for the primary key (not UUID v7 — this is an exception to the project convention)
- **REQ-036**: Media has `organizationId` field with an index for multi-tenant scoping
- **REQ-037**: Media has `key` field with a `@unique` constraint mapping to the S3 object path
- **REQ-038**: Media has `purpose` field with an index for filtering
- **REQ-039**: Media model uses `@@map("media")` for database table naming
- **REQ-040**: `ProductImage` and `VariantImage` are junction tables linking Media to Product/Variant with `onDelete: Cascade` on both parent and media relations
- **REQ-041**: Both `ProductImage` and `VariantImage` have `@@unique([mediaId])` — a single media can only be attached to one product or one variant
- **REQ-042**: The Media model does **not** have a `deletedAt` field — deletions are permanent

### 3.6 Constraints

- **CON-001**: Presigned URLs expire after 15 minutes — if the client does not complete the PUT within this window, the upload will fail and the media record becomes orphaned
- **CON-002**: The `confirmUpload` endpoint does not verify the file actually exists in S3 — it only checks the DB record exists. Orphaned records (presigned but never uploaded) may exist
- **CON-003**: Image compression is client-side only — non-image files are uploaded without modification
- **CON-004**: `MAX_FILE_SIZE` (50 MB) is enforced at the Zod validation layer and in the service, but the actual S3 PUT has no server-side size limit enforcement (depends on S3 bucket configuration)
- **CON-005**: `MultiFileUpload` enforces a configurable `maxFiles` limit (default 5) and `maxSize` limit (default 4 MB) at the UI level, but the backend enforces 50 MB — these limits serve different purposes (UX vs storage)
- **CON-006**: `void logAudit(...)` is fire-and-forget (not awaited) to avoid blocking response
- **CON-007**: Media deletion is permanent — there is no soft delete, no trashed view, and no restore mechanism
- **CON-008**: The `getPublicUrl` function returns an empty string if `S3_PUBLIC_URL` is not configured — callers should handle this case

### 3.7 Guidelines

- **GUD-001**: Use `MultiFileUpload` for any feature that needs multiple images with reordering (products, variants)
- **GUD-002**: Use `FileUpload` for single-file upload scenarios (avatars, documents)
- **GUD-003**: When consuming uploads in a form, track pending images via `useState<PendingImage[]>()` and submit their media IDs to the parent resource on form submit
- **GUD-004**: Disable the form submit button while any pending images are in `uploading` or `error` state to prevent incomplete submissions
- **GUD-005**: Clean up orphaned media records periodically via a scheduled job (not yet implemented — future consideration)
- **GUD-006**: Barrel export (`index.ts`) at every module/hooks/components directory level

## 4. Interfaces & Data Contracts

### 4.1 Upload Lifecycle

The upload flow uses a three-step presigned URL pattern to avoid proxying file data through the backend:

```
Client                              Backend                             S3
  |                                   |                                   |
  |  1. POST /uploads/presign         |                                   |
  |  { filename, contentType, size }  |                                   |
  |  -------------------------------->|                                   |
  |                                   |  Create Media record (DB)         |
  |                                   |  Generate presigned PUT URL       |
  |  { id, key, uploadUrl }           |  -------------------------------->|
  |  <--------------------------------|                                   |
  |                                   |                                   |
  |  2. PUT {uploadUrl}               |                                   |
  |  (file body, Content-Type header) |                                   |
  |  ------------------------------------------------------------------>|
  |  200 OK                           |                                   |
  |  <------------------------------------------------------------------|
  |                                   |                                   |
  |  3. POST /uploads/:id/confirm     |                                   |
  |  -------------------------------->|                                   |
  |  { id, key, filename, ..., url }  |                                   |
  |  <--------------------------------|                                   |
```

**Progress tracking**: The frontend reports progress at four stages — 0% (idle), 20% (compression done), 40% (presign received), 80% (S3 PUT done), 100% (confirm received).

### 4.2 HTTP Endpoints

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| POST | `/uploads/presign` | Request a presigned upload URL and create a pending media record | `media:create` | `201 { id, key, uploadUrl }` |
| POST | `/uploads/:id/confirm` | Confirm that an upload to S3 has been completed | `media:create` | `200 Media` or `404` |
| GET | `/uploads` | List media (paginated, filterable by purpose) | `media:view` | `{ data: Media[], meta: PaginationMeta }` |
| GET | `/uploads/:id` | Get a single media record with public URL | `media:view` | `Media` or `404` |
| DELETE | `/uploads/:id` | Delete a media record and its file from S3 | `media:delete` | `{ message }` or `404` |

### 4.3 Query Parameters (List Endpoint)

```typescript
interface ListMediaQuery {
  page: number;        // default: 1
  pageSize: number;    // default: 10
  purpose?: string;    // filter by purpose tag (e.g., "product-image", "avatar")
}
```

### 4.4 Response Shapes

```typescript
interface PresignResponse {
  id: string;        // UUID of the created Media record
  key: string;       // S3 object key
  uploadUrl: string; // Presigned PUT URL (expires in 15 minutes)
}

interface Media {
  id: string;
  organizationId: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;          // File size in bytes
  purpose: string | null;
  url: string;           // Public URL constructed from S3_PUBLIC_URL
  createdAt: string;     // ISO 8601 datetime
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface ErrorResponse {
  message: string;
}
```

### 4.5 Zod Schema Definitions

#### Presign Upload

```typescript
const presignUploadDto = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().positive().max(MAX_FILE_SIZE), // 50 MB
  purpose: z.string().optional(),
})

const presignResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  uploadUrl: z.string(),
})
```

#### Media

```typescript
const mediaSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  key: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  purpose: z.string().nullable(),
  url: z.string(),
  createdAt: z.iso.datetime(),
})
```

#### Route Parameter

```typescript
const mediaIdParam = z.object({
  id: z.string().uuid(),
})
```

#### List Query

```typescript
const listMediaQuery = paginationQuery.extend({
  purpose: z.string().optional(),
})
```

### 4.6 Prisma Models

```prisma
model Media {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  key            String       @unique
  filename       String
  contentType    String
  size           Int
  purpose        String?
  createdAt      DateTime     @default(now())

  productImages ProductImage[]
  variantImages VariantImage[]

  @@index([organizationId])
  @@index([purpose])
  @@map("media")
}

model ProductImage {
  id        String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  productId String   @db.Uuid
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  mediaId   String
  media     Media    @relation(fields: [mediaId], references: [id], onDelete: Cascade)
  altText   String?
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  @@unique([mediaId])
  @@index([productId])
  @@map("product_image")
}

model VariantImage {
  id        String         @id @default(dbgenerated("uuidv7()")) @db.Uuid
  variantId String         @db.Uuid
  variant   ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  mediaId   String
  media     Media          @relation(fields: [mediaId], references: [id], onDelete: Cascade)
  altText   String?
  sortOrder Int            @default(0)
  createdAt DateTime       @default(now())

  @@unique([mediaId])
  @@index([variantId])
  @@map("variant_image")
}
```

**Relationship summary**: `Media` is a shared resource referenced by `ProductImage` and `VariantImage` junction tables. Each media can be attached to at most one product or one variant (enforced by `@@unique([mediaId])` on each junction table). Deleting a product cascades to its `ProductImage` records, which cascade to their `Media` records (permanent deletion). Deleting a media record requires no cascade — the junction record has `onDelete: Cascade` from the media side.

### 4.7 Frontend Query Key Factory

```typescript
export const mediaKeys = {
  all: ['media'] as const,
  lists: () => [...mediaKeys.all, 'list'] as const,
  list: (params: { page?: number; pageSize?: number; purpose?: string }) =>
    [...mediaKeys.lists(), params] as const,
  details: () => [...mediaKeys.all, 'detail'] as const,
  detail: (id: string) => [...mediaKeys.details(), id] as const,
}
```

### 4.8 Frontend Cache Invalidation Patterns

```typescript
// After a successful upload (in useUpload hook):
queryClient.invalidateQueries({ queryKey: mediaKeys.lists() })

// After deleting a media record:
queryClient.invalidateQueries({ queryKey: mediaKeys.lists() })
queryClient.invalidateQueries({ queryKey: mediaKeys.detail(id) })
```

### 4.9 Frontend Component Structure

```
modules/uploads/
  index.ts
  hooks/
    index.ts
    use-upload.ts              # Single-file upload hook (presign -> PUT -> confirm lifecycle)
    use-media.ts               # Media query hooks + query key factory + Media type export
  components/
    file-upload.tsx            # Single-file dropzone with drag-and-drop, preview, progress
    multi-file-upload.tsx      # Multi-file uploader with dnd-kit reordering, pending tracking
```

### 4.10 Frontend Component API

#### FileUpload

```typescript
interface FileUploadProps {
  onUploaded: (media: Media) => void;   // Called when upload completes successfully
  purpose?: string;                      // Upload purpose tag
  accept?: string;                       // Accepted file types (default: 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip')
  maxWidth?: number;                     // Max image width for compression (default: 1920)
  quality?: number;                      // Image compression quality (default: 0.8)
  className?: string;
  disabled?: boolean;
}
```

**Features**: Drag-and-drop, click-to-browse, image preview with filename/size, progress bar, error display, remove uploaded file, keyboard accessible, 50MB max label.

#### MultiFileUpload

```typescript
interface MultiFileUploadProps {
  existingImages: ExistingImage[];                                   // Server-persisted images
  onRemoveExisting: (imageId: string) => void;                       // Remove existing image
  onReorderExisting?: (imageIds: string[]) => void;                   // Reorder existing images
  pendingImages: PendingImage[];                                      // Files in upload progress
  onSetPendingImages: React.Dispatch<React.SetStateAction<PendingImage[]>>;  // Update pending state
  purpose?: string;                                                   // Upload purpose (default: 'product-image')
  accept?: string;                                                    // Accepted file types (default: 'image/*')
  label?: string;                                                     // Label text (default: 'Foto Produk')
  disabled?: boolean;
  maxFiles?: number;                                                  // Max file count (default: 5)
  maxSize?: number;                                                   // Max file size in MB (default: 4)
  className?: string;
}

type ExistingImage = {
  id: string;
  url: string;
  altText?: string | null;
}

type PendingImage = {
  status: 'uploading' | 'done' | 'error';
  file: File;
  media?: Media;
  error?: string;
}
```

**Features**: Drag-and-drop multi-file selection, `@dnd-kit` sortable reordering of both existing and pending images, file count cap enforcement, deduplication by filename, retry on error, progress indicators (spinner overlay, status text), preview URLs via `URL.createObjectURL` with cleanup on unmount, responsive 3-column grid layout, Indonesian UI text.

### 4.11 Frontend Hook API

#### useUpload

```typescript
type UploadResult = {
  upload: (file: File, options?: UploadOptions) => Promise<Media>;
  media: Media | null;       // Last successfully uploaded media
  error: string | null;      // Last upload error message
  isUploading: boolean;      // Whether an upload is in progress
  progress: number;          // Upload progress (0-100)
  reset: () => void;         // Clear all state
}

type UploadOptions = {
  maxWidth?: number;         // Max image width for compression
  quality?: number;          // Image compression quality (0-1)
  purpose?: string;          // Upload purpose tag
}
```

**Behavior**: On call to `upload(file)`:
1. Resets state (media, error, progress)
2. Compresses image files via `browser-image-compression` (skipped for non-images)
3. Sets progress to 20%
4. Calls `POST /uploads/presign` with processed file metadata
5. Sets progress to 40%
6. Performs `fetch(uploadUrl, { method: 'PUT', body: file })`
7. Sets progress to 80%
8. Calls `POST /uploads/:id/confirm` to get the finalized media record
9. Sets progress to 100%, invalidates media list cache
10. Returns the confirmed Media object

**Image types eligible for compression**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/bmp`, `image/tiff`

#### useMedia

```typescript
function useMedia(id: string): UseQueryResult<Media>
function useMediaUrl(id: string): string | null
function useMediaList(params?: { page?: number; pageSize?: number; purpose?: string }): UseQueryResult<PaginatedResponse<Media>>
```

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `media:create` permission, When they `POST /uploads/presign` with valid filename, contentType, and size (≤ 50 MB), Then a presigned PUT URL and media ID are returned (201) and a Media record is created in the database
- **AC-002**: Given an authenticated user with `media:create` permission, When they `POST /uploads/presign` with size exceeding 50 MB, Then a `422` validation error is returned
- **AC-003**: Given an authenticated user with `media:create` permission, When they `POST /uploads/presign` with size of zero, Then a `422` validation error is returned
- **AC-004**: Given an authenticated user with `media:create` permission, When they `POST /uploads/:id/confirm` after uploading the file to the presigned URL, Then the full media record with public URL is returned (200)
- **AC-005**: Given a media ID that does not belong to the organization, When `POST /uploads/:id/confirm` is called, Then a `404` is returned
- **AC-006**: Given an authenticated user with `media:view` permission, When they `GET /uploads`, Then they receive a paginated list of media scoped to their organization with public URLs
- **AC-007**: Given an authenticated user with `media:view` permission, When they `GET /uploads?purpose=product-image`, Then only media with that purpose are returned
- **AC-008**: Given an authenticated user with `media:view` permission, When they `GET /uploads/:id`, Then the media record with public URL is returned
- **AC-009**: Given an authenticated user with `media:delete` permission, When they `DELETE /uploads/:id`, Then the S3 object is deleted, the DB record is deleted, and `{ message: 'Media deleted' }` is returned (200)
- **AC-010**: Given a media ID that does not exist, When `DELETE /uploads/:id` is called, Then a `404` is returned and no S3 deletion is attempted
- **AC-011**: Given the `FileUpload` component, When a user drops or selects an image file, Then the file is compressed, uploaded via presigned URL flow, and `onUploaded` is called with the confirmed Media
- **AC-012**: Given the `MultiFileUpload` component, When a user drops multiple image files, Then each file is uploaded independently, pending images are tracked with status (uploading/done/error), and the file count cap is enforced
- **AC-013**: Given a pending image in error state, When the user clicks retry, Then the upload is retried with the same file
- **AC-014**: Given existing and pending images, When the user drags to reorder, Then existing image IDs are reported via `onReorderExisting` and pending images are reordered in local state
- **AC-015**: Given an unauthenticated request, When any endpoint is called, Then a `401 Unauthorized` is returned
- **AC-016**: Given a user without the required permission, When the endpoint is called, Then a `403 Forbidden` is returned
- **AC-017**: Given an invalid UUID in the `:id` param, When any endpoint expecting it is called, Then a `422` validation error is returned

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for route handlers using mocked services and S3 integration
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `uploads.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern
- **Test Data Management**: Mock modules for `authPlugin`, `uploadsService`, and S3 integration (`presignPut`, `deleteObject`, `getPublicUrl`, `MAX_FILE_SIZE`)
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**:
  - Presign endpoint: success with optional purpose, missing filename (422), size exceeds 50 MB (422), size zero (422), missing contentType (422)
  - Confirm endpoint: success with URL in response, unknown media ID (404), invalid UUID (422)
  - List endpoint: paginated response with URL, purpose filter
  - Get endpoint: success with URL, not found (404), invalid UUID (422)
  - Delete endpoint: success with message, not found (404), invalid UUID (422)
- **Frontend Testing**: Test `useUpload` hook with mocked API calls; test `FileUpload` and `MultiFileUpload` with `render` + user interaction events

## 7. Rationale & Context

### Why Presigned URLs Instead of Server Proxy?
Uploading files through the backend would consume server bandwidth, memory, and CPU — and would tie up Bun's event loop for large files. The presigned URL pattern offloads the actual data transfer directly from the client to S3, making the backend only responsible for metadata management. This scales better and keeps the backend lightweight.

### Why Three-Step Upload (Presign -> PUT -> Confirm)?
The presign step creates the DB record upfront, reserving the S3 key. The PUT step transfers the file directly to S3. The confirm step lets the client signal completion and receive the public URL. This separation allows the backend to track all attempted uploads (including failed ones) and provides a clean point for any post-upload processing (e.g., thumbnail generation) in the future.

### Why No Soft Delete on Media?
Media records represent binary objects in S3. Unlike business entities (products, categories), there is no meaningful "trashed" state for a file — it either exists in storage or it does not. Soft-deleting the DB record while leaving the S3 object would waste storage; soft-deleting both would add complexity without clear benefit. If audit trails are needed, the existing `AuditLog` captures delete operations.

### Why UUID v4 Instead of UUID v7 for Media?
The Media model uses `@default(uuid())` (v4) rather than `@default(dbgenerated("uuidv7()"))`. This may be an oversight or intentional — the S3 key already uses `crypto.randomUUID()` (v4) for the filename segment, and media records are typically looked up by ID directly rather than sorted by creation time.

### Why Client-Side Image Compression?
Compressing images before upload reduces bandwidth consumption (especially on mobile networks), reduces S3 storage costs, and improves page load times when images are displayed. The `browser-image-compression` library runs in a Web Worker by default, avoiding main-thread blocking.

### Why @dnd-kit for Reordering?
`@dnd-kit` is the modern standard for accessible drag-and-drop in React. It provides keyboard sensor support (a11y), smooth animations, and composable primitives that integrate cleanly with both existing and pending image arrays in `MultiFileUpload`.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **S3-compatible object storage** - Stores all uploaded files; configured via environment variables (`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL`)
- **EXT-002**: **PostgreSQL** - Stores media metadata via Prisma ORM

### Third-Party Services
- **SVC-001**: **better-auth** - Authentication and organization membership; provides `authPlugin` with `user`, `organization`, `_authType` context
- **SVC-002**: **@aws-sdk/client-s3** - S3 client for generating presigned URLs and deleting objects
- **SVC-003**: **@aws-sdk/s3-request-presigner** - Generates time-limited presigned PUT URLs
- **SVC-004**: **browser-image-compression** - Client-side image compression with Web Worker support
- **SVC-005**: **@dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities** - Drag-and-drop reordering for `MultiFileUpload`

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **Products** - Consumes `MultiFileUpload` and `FileUpload` for product images via `ProductImage` junction table
- **DAT-002**: **ProductVariants** - Consumes `MultiFileUpload` for variant images via `VariantImage` junction table
- **DAT-003**: **Organization** - All media records are scoped by `organizationId` with cascade delete from organization

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with TypeBox/Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer with migration management
- **PLT-003**: **TanStack Query** - Server state management (caching, invalidation)
- **PLT-004**: **@dnd-kit** - Accessible drag-and-drop primitives for sortable lists
- **PLT-005**: **shadcn/ui + Radix** - UI component primitives (Button)
- **PLT-006**: **Lucide React** - Icon library

### Compliance Dependencies
- **COM-001**: **Audit logging** - All write operations (presign, confirm, delete) must be logged with user identity and operation details

## 9. Examples & Edge Cases

### 9.1 Backend Route Plugin

```typescript
import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { uploadsService } from './uploads.service'
import { errorResponse } from '#common/error.response'
import { logAudit } from '#libraries/audit-logger'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
} from '#common/pagination'
import { getPublicUrl, MAX_FILE_SIZE } from '#integrations/s3'

export const presignUploadDto = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().positive().max(MAX_FILE_SIZE),
  purpose: z.string().optional(),
})

export const mediaSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  key: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  purpose: z.string().nullable(),
  url: z.string(),
  createdAt: z.iso.datetime(),
})

export type Media = z.infer<typeof mediaSchema>
export type PresignUploadInput = z.infer<typeof presignUploadDto>

const presignResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  uploadUrl: z.string(),
})

export const uploadsRoute = new Elysia({
  prefix: '/uploads',
  tags: ['Uploads'],
})
  .use(authPlugin)
  .post('/presign', async ({ _authType, organization, user, body, status }) => {
    const { media, uploadUrl } = await uploadsService.presignUpload(organization.id, body)
    void logAudit({
      organizationId: organization.id,
      userId: user.id,
      authType: _authType,
      model: 'Media',
      operation: 'presign',
      args: { data: body },
    })
    return status(201, { id: media.id, key: media.key, uploadUrl })
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { media: ['create'] },
    body: presignUploadDto,
    response: { 201: presignResponseSchema },
    detail: {
      summary: 'Request presigned upload URL',
      description: 'Returns a presigned PUT URL for direct upload to S3-compatible storage and creates a pending media record.',
    },
  })
```

### 9.2 Backend Service

```typescript
import { prisma } from '#integrations/prisma'
import { presignPut, deleteObject, MAX_FILE_SIZE } from '#integrations/s3'

export const uploadsService = {
  async presignUpload(
    organizationId: string,
    input: { filename: string; contentType: string; size: number; purpose?: string },
  ) {
    if (input.size <= 0 || input.size > MAX_FILE_SIZE) {
      throw new Error(`File size must be between 1 and ${MAX_FILE_SIZE} bytes`)
    }

    const ext = input.filename.includes('.')
      ? input.filename.slice(input.filename.lastIndexOf('.') + 1)
      : ''
    const key = [organizationId, input.purpose ?? 'uploads', `${crypto.randomUUID()}.${ext}`].join('/')

    const media = await prisma.media.create({
      data: { organizationId, key, filename: input.filename, contentType: input.contentType, size: input.size, purpose: input.purpose },
    })

    const { url } = await presignPut(key, input.contentType)
    return { media, uploadUrl: url }
  },

  async confirmUpload(organizationId: string, id: string) {
    const media = await prisma.media.findFirst({ where: { id, organizationId } })
    if (!media) return null
    return prisma.media.findUniqueOrThrow({ where: { id } })
  },

  async deleteMedia(organizationId: string, id: string) {
    const media = await prisma.media.findFirst({ where: { id, organizationId } })
    if (!media) return null
    await deleteObject(media.key)
    return prisma.media.delete({ where: { id } })
  },
}
```

### 9.3 Frontend Upload Hook Usage

```typescript
// Single file upload in a form component
function AvatarForm() {
  const { upload, media, error, isUploading, progress, reset } = useUpload()

  const handleFile = async (file: File) => {
    try {
      const result = await upload(file, { purpose: 'avatar', maxWidth: 512, quality: 0.9 })
      // result is the confirmed Media object — save media.id to parent resource
    } catch {
      // error is available via error state
    }
  }

  return <FileUpload onUploaded={(m) => saveAvatar(m.id)} purpose="avatar" accept="image/*" />
}
```

### 9.4 Frontend MultiFileUpload Usage

```typescript
// Multi-file upload in product form
function ProductImageSection({ product }: { product: Product }) {
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const hasAnyUploading = pendingImages.some((p) => p.status === 'uploading')
  const hasAnyError = pendingImages.some((p) => p.status === 'error')

  const existingImages = product.images.map((img) => ({
    id: img.id,
    url: img.media.url,
    altText: img.altText,
  }))

  return (
    <MultiFileUpload
      existingImages={existingImages}
      onRemoveExisting={(imageId) => removeProductImage.mutate({ productId: product.id, imageId })}
      onReorderExisting={(ids) => reorderProductImages.mutate({ productId: product.id, imageIds: ids })}
      pendingImages={pendingImages}
      onSetPendingImages={setPendingImages}
      purpose="product-image"
      maxFiles={5}
      maxSize={4}
    />
  )
}
```

### 9.5 Edge Cases

- **Presigned URL expiry**: If the client does not complete the S3 PUT within 15 minutes, the presigned URL expires and the upload fails. The Media DB record remains orphaned — no automatic cleanup exists yet
- **File extension missing**: Files without an extension produce an S3 key like `{orgId}/uploads/{uuid}.` — the empty extension segment is harmless but not ideal
- **Duplicate filename deduplication**: `MultiFileUpload` deduplicates pending files by filename, preventing the same file from being added twice in a single session
- **File count cap**: `MultiFileUpload` silently caps the number of new files to `maxFiles - existingImages.length - pendingImages.length` — excess files are dropped without error
- **Non-image files**: Files that are not in the `IMAGE_TYPES` set bypass client-side compression and are uploaded at their original size
- **S3_PUBLIC_URL not configured**: If `S3_PUBLIC_URL` is not set, `getPublicUrl()` returns an empty string. The media record is returned with `url: ""` — the frontend should handle missing URLs gracefully
- **Concurrent uploads**: `MultiFileUpload` fires uploads concurrently (not sequentially) for dropped files — each upload is independent with its own error handling
- **Preview URL memory leak prevention**: `MultiFileUpload` creates `URL.createObjectURL()` previews for pending images and revokes them via `useEffect` cleanup on unmount
- **Cross-organization access**: The `confirmUpload` and `deleteMedia` endpoints scope by `organizationId` — a user cannot confirm or delete media belonging to another organization
- **Image attached to product and variant**: A single media record can only be attached to one product OR one variant due to the `@@unique([mediaId])` constraint on both junction tables — attempting to attach the same media to both will fail at the DB level

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/uploads/` with `.route.ts`, `.service.ts`, `.test.ts`; frontend has `hooks/`, `components/`, `index.ts`
2. **Auth & permissions**: All endpoints use `authPlugin`, `requireAuth`, `requireOrg`, and `requirePermission: { media: ['action'] }`
3. **Serialization**: All Date fields return ISO 8601 strings; public URL appended via `getPublicUrl(key)`
4. **Presigned URL flow**: Upload lifecycle follows presign -> client PUT -> confirm three-step pattern
5. **File size enforcement**: `MAX_FILE_SIZE` (50 MB) enforced at Zod validation and service layer
6. **Pagination**: List endpoint accepts `page`, `pageSize`, `purpose`; returns `{ data, meta }`
7. **Audit logging**: All write operations (presign, confirm, delete) call `void logAudit(...)` with correct model, operation, and args
8. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
9. **Frontend query keys**: Hierarchical factory with `all`, `lists()`, `list(params)`, `detail(id)`
10. **Cache invalidation**: Successful upload invalidates `mediaKeys.lists()`
11. **Image compression**: Client-side compression for image types via `browser-image-compression` before upload
12. **Indonesian UI**: All user-facing text in `MultiFileUpload` is in Bahasa Indonesia
13. **Permanent deletion**: Media deletion removes both the S3 object and DB record — no soft delete

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Products specification (parent consumer): `specs/products/spec-v1.md`
- Backend shared utilities: `packages/backend/src/common/pagination.ts`, `packages/backend/src/common/error.response.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- S3 integration: `packages/backend/src/integrations/s3.ts`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- Product form sheet (consumer of MultiFileUpload): `packages/frontend/src/modules/products/components/product-form-sheet.tsx`
- Variant form sheet (consumer of MultiFileUpload): `packages/frontend/src/modules/products/components/variant-form-sheet.tsx`

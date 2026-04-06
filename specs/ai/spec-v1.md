---
title: AI Assistant — Natural Language Interface for Products
version: v1
date_created: 2026-04-05
last_updated: 2026-04-05
owner: Backend Team
feature: ai
tags: [ai, llm, openai, tool-calls, products, elysia, integration]
---

# Introduction

This specification defines the AI Assistant module — a natural language interface that allows users to interact with the product inventory system using plain text. Users can search, create, update, and delete products, variants, and categories by describing what they want in natural language. The assistant uses OpenAI-compatible tool calling (function calling) to dispatch user intents to existing service methods.

The LLM integration is built as a reusable integration (`src/integrations/llm.ts`) so it can be extended to other modules in the future.

## 1. Purpose & Scope

This specification defines:

- **LLM integration**: A reusable, provider-agnostic OpenAI-compatible client and tool-call loop
- **AI service layer**: Tool definitions mapped to product/variant/category service methods with RBAC enforcement and write confirmation
- **AI route**: A single chat endpoint that accepts natural language messages and returns AI responses
- **Conversation support**: Multi-turn conversations via client-managed message history

**Audience**: Developers building the AI assistant module or extending the LLM integration to other modules.

**Assumptions**: The reader is familiar with the OpenAI Chat Completions API tool calling protocol, Elysia.js, and the existing products module architecture.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Tool Call** | A mechanism where the LLM outputs a structured function invocation (name + arguments) that the application executes locally, then feeds the result back to the LLM |
| **Tool Definition** | A JSON Schema object describing a function the LLM can call, including name, description, and parameter schema |
| **Tool Executor** | Application code that receives a tool name and arguments, executes the corresponding service method, and returns the result as a string |
| **Tool Loop** | The iterative cycle: LLM response → tool calls → execute tools → feed results → LLM response → ... until a final text answer is produced |
| **Finish Reason** | The `finish_reason` field in the LLM response: `"stop"` for final text, `"tool_calls"` when tools need execution |
| **OpenAI-Compatible** | Any LLM provider that implements the same `/v1/chat/completions` wire format as OpenAI (OpenRouter, Groq, Together, Ollama, etc.) |
| **Write Confirmation** | The pattern where the AI describes a write operation and asks the user to confirm before executing it |
| **Conversation History** | An array of previous `{ role, content }` messages sent by the client to maintain multi-turn context |

## 3. Requirements, Constraints & Guidelines

### 3.1 LLM Integration

- **REQ-001**: The LLM client must be implemented as a reusable integration at `packages/backend/src/integrations/llm.ts`
- **REQ-002**: The integration must use the `openai` npm package configured with `baseURL` and `apiKey` from environment variables
- **REQ-003**: The integration must support any OpenAI-compatible provider by changing `LLM_BASE_URL` and `LLM_API_KEY` environment variables only
- **REQ-004**: The integration must export a `runToolLoop()` function that accepts: system prompt, user message, conversation history, tool definitions, tool executor function, and optional max iterations
- **REQ-005**: `runToolLoop()` must handle parallel tool calls (multiple tools in one response) by executing all and returning all results before the next LLM call
- **REQ-006**: `runToolLoop()` must handle JSON parse errors in tool arguments by returning the error as a tool result message
- **REQ-007**: `runToolLoop()` must handle tool execution errors by returning the error as a tool result message
- **REQ-008**: `runToolLoop()` must enforce a maximum iteration limit (default: 10) and throw if exceeded
- **REQ-009**: `runToolLoop()` must return `RunToolLoopResult` containing the final text reply, any `pendingActions` (intercepted writes), and any `actionResults` (executed confirmed writes). Must throw when `finish_reason` is `"length"` (truncated response).

### 3.2 Environment Variables

- **REQ-010**: The following environment variables must be supported:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_API_KEY` | Yes | — | Provider API key |
| `LLM_BASE_URL` | No | `https://api.openai.com/v1` | Provider API base URL |
| `LLM_MODEL` | No | `gpt-4o` | Model identifier string |

### 3.3 AI Route

- **REQ-011**: A single `POST /ai/chat` endpoint must accept `{ message: string, messages?: ChatMessage[], confirmedWriteTools?: string[] }` and return a discriminated union `ChatResponse`
- **REQ-012**: The endpoint must require authentication (`requireAuth: true`) and organization context (`requireOrg: true`)
- **REQ-013**: The endpoint must be tagged `['AI']` for OpenAPI documentation
- **REQ-014**: Request body must validate `message` as a non-empty string (max 2000 characters)
- **REQ-015**: Optional `messages` field must be an array of `{ role: 'user' \| 'assistant', content: string }` with a maximum of 20 entries
- **REQ-016**: The endpoint must return `200` with `ChatResponse` on success — `type: 'text'` for read-only, `type: 'confirmation_required'` when writes were intercepted, `type: 'action_result'` when confirmed writes were executed
- **REQ-017**: The endpoint must return `502` with `{ error: string }` if the LLM provider is unreachable or returns an error

### 3.4 Tool Definitions

- **REQ-018**: Tool definitions must be JSON Schema objects following the OpenAI function calling format: `{ type: 'function', function: { name, description, parameters } }`
- **REQ-019**: Each tool definition must include a `description` that clearly explains when the tool should be used
- **REQ-020**: Each tool parameter must include a `description` explaining the expected value, format, and constraints
- **REQ-021**: `required` arrays must be used to mark mandatory parameters
- **REQ-022**: Parameter schemas must use only primitive JSON Schema types (`string`, `number`, `integer`, `boolean`, `array`) for cross-provider compatibility
- **REQ-023**: `additionalProperties: false` must NOT be set on parameter objects (not all providers support it)
- **REQ-024**: `strict: true` must NOT be used (OpenAI-specific, breaks cross-provider compatibility)

### 3.5 RBAC Enforcement

- **REQ-025**: Each tool must be associated with a permission requirement (e.g., `product:view`, `product:create`)
- **REQ-026**: The tool executor must check the user's permissions against the tool's required permission before execution
- **REQ-027**: If permission is denied, the executor must return `{ success: false, error: { code: 'PERMISSION_DENIED', message: '...' } }` as the tool result
- **REQ-028**: Permission checking must use the existing access control system via `auth.api.hasPermission` — the route creates a `checkPermission` callback and passes it to the service, ensuring custom roles and API keys are supported (not just system roles)
- **REQ-029**: The tool executor must receive the user ID, organization ID, user role, and auth type as context for permission checks and audit logging

### 3.6 Write Confirmation (Code-Level Enforcement)

- **REQ-030**: Write confirmation must be enforced at the code level in `runToolLoop()`, not via system prompt alone
- **REQ-031**: Each write tool definition must include `isWrite: true` metadata (see Section 4.7)
- **REQ-032**: `runToolLoop()` must intercept any tool call where `tool.isWrite === true` and the tool name is NOT present in `confirmedWriteTools`
- **REQ-033**: Intercepted write tools must NOT be executed — instead, a structured pending result must be returned to the LLM as a tool result: `{ success: false, pending: true, tool: string, args: Record<string, unknown> }`
- **REQ-034**: `runToolLoop()` must track all intercepted writes in a `pendingActions` array and include them in the return value
- **REQ-035**: When a write tool name IS present in `confirmedWriteTools`, `runToolLoop()` must execute it normally and track the result in an `actionResults` array
- **REQ-036**: The `confirmedWriteTools` array must be passed from the chat request (Section 4.2) through to `runToolLoop()` config
- **REQ-037**: The system prompt must instruct the AI that when it receives a pending result for a write tool, it should explain the pending action to the user and inform them that confirmation is required
- **REQ-038**: The system prompt must instruct the AI that when a write tool executes successfully (after confirmation), it should report the result to the user

### 3.7 Tool-to-Service Mapping

- **REQ-034**: The following tools must be defined:

| Tool Name | Permission | Maps to | Write? |
|-----------|-----------|---------|--------|
| `search_products` | `product:view` | `productsService.listProducts` | No |
| `get_product` | `product:view` | `productsService.getProduct` | No |
| `create_product` | `product:create` | `productsService.createProduct` | Yes |
| `update_product` | `product:update` | `productsService.updateProduct` | Yes |
| `delete_product` | `product:delete` | `productsService.deleteProduct` | Yes |
| `restore_product` | `product:delete` | `productsService.restoreProduct` | Yes |
| `list_categories` | `productCategory:view` | `productCategoriesService.listCategories` (or direct Prisma) | No |
| `get_product_variants` | `productVariant:view` | `productsService.getProduct` (extract variants) | No |
| `create_variant` | `productVariant:create` | `variantsService.createVariant` | Yes |
| `update_variant` | `productVariant:update` | `variantsService.updateVariant` | Yes |
| `delete_variant` | `productVariant:delete` | `variantsService.deleteVariant` | Yes |

### 3.8 Tool Result Serialization

- **REQ-035**: All tool results must serialize Prisma types before returning to the LLM: `Date` → ISO 8601 string, `Decimal` → number
- **REQ-036**: Tool results must be JSON-serialized strings (the LLM API requires `content` as a string)
- **REQ-037**: Successful results must use the shape `{ success: true, data: ... }`
- **REQ-038**: Error results must use the shape `{ success: false, error: { code: string, message: string } }`

### 3.9 System Prompt

- **REQ-039**: The system prompt must be in Indonesian (Bahasa Indonesia) for user-facing instructions
- **REQ-040**: The system prompt must describe the assistant as a helpful product inventory management assistant
- **REQ-041**: The system prompt must list all available tools with brief descriptions of what each can do
- **REQ-042**: The system prompt must include the write confirmation instructions (REQ-030 through REQ-033)
- **REQ-043**: The system prompt must instruct the AI to be concise and present data in a readable format (lists, tables)
- **REQ-044**: The system prompt must instruct the AI to handle permission errors gracefully by informing the user in Indonesian

### 3.10 Auto-Slug Generation

- **REQ-045**: When `create_product` is called without a `slug` parameter, the tool executor must generate a slug from the `name` parameter (lowercase, spaces → hyphens, strip special characters, `a-z0-9-` only)
- **REQ-046**: When `create_product` is called without a `description` parameter, the executor must set it to `null`

### 3.11 Pagination for Read Tools

- **REQ-047**: `search_products` must accept `page` (default 1) and `pageSize` (default 10, max 50) parameters
- **REQ-048**: `search_products` must accept optional `search`, `categoryId`, and `sortBy`/`sortOrder` parameters
- **REQ-049**: `search_products` must return both `data` (array of products) and `meta` (pagination info) in the tool result
- **REQ-050**: `list_categories` must accept optional `parentId` parameter to filter by parent category

### 3.12 Error Handling

- **REQ-051**: If the LLM provider returns a network error or non-200 response, the route must return `502` with `{ error: 'AI service unavailable' }`
- **REQ-052**: If `LLM_API_KEY` is not configured, the integration must not crash at module load — it must throw a descriptive error when `runToolLoop()` is called
- **REQ-053**: Tool execution errors (e.g., Prisma unique constraint violation) must be returned as structured error tool results

### 3.13 Constraints

- **CON-001**: Non-streaming only for v1 — the full response is returned after the tool loop completes
- **CON-002**: Conversation history is managed client-side — the server is stateless
- **CON-003**: Maximum 20 conversation history messages to limit token usage
- **CON-004**: Maximum 2000 characters per user message to prevent abuse
- **CON-005**: Maximum 10 tool loop iterations to prevent runaway loops
- **CON-006**: No image upload via AI — tools only cover CRUD text operations
- **CON-007**: Products only for v1 — other modules can be added by defining additional tool definitions
- **CON-008**: `finish_reason === 'length'` (truncated response) throws an error rather than returning incomplete output

### 3.14 Guidelines

- **GUD-001**: Tool descriptions should be written as if instructing a new developer — state what the tool does, when to use it, and any important side effects
- **GUD-002**: Keep tool count under 20 for optimal LLM accuracy
- **GUD-003**: When adding tools for new modules, reuse the same `runToolLoop()` from `#integrations/llm` and only add new tool definitions + executors
- **GUD-004**: Use `finish_reason === 'tool_calls' || finish_reason === 'function_call'` for maximum cross-provider compatibility
- **GUD-005**: Always include the `name` field on `role: 'tool'` messages (some providers require it)

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoint

| Method | Path | Description | Auth | Response |
|--------|------|-------------|------|----------|
| POST | `/ai/chat` | Send a message to the AI assistant | `requireAuth` + `requireOrg` | `{ reply: string }` |

### 4.2 Request Schema

```typescript
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(2000),
})

const chatRequestDto = z.object({
  message: z.string().min(1).max(2000),
  messages: z.array(chatMessageSchema).max(20).optional(),
  confirmedWriteTools: z.array(z.string()).optional(),
})

type ChatRequest = z.infer<typeof chatRequestDto>
```

The optional `confirmedWriteTools` field contains tool names (e.g., `['create_product']`) that the user has explicitly confirmed via the frontend. These are passed through to `runToolLoop()` to allow execution of intercepted write tools.

### 4.3 Response Schemas

```typescript
interface PendingAction {
  tool: string
  args: Record<string, unknown>
}

interface ActionResult {
  tool: string
  success: boolean
  data?: unknown
  error?: { code: string; message: string }
}

type ChatResponse =
  | { type: 'text'; reply: string }
  | { type: 'confirmation_required'; reply: string; pendingActions: PendingAction[] }
  | { type: 'action_result'; reply: string; actionResults: ActionResult[] }

const chatSuccessResponse = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    reply: z.string(),
  }),
  z.object({
    type: z.literal('confirmation_required'),
    reply: z.string(),
    pendingActions: z.array(
      z.object({
        tool: z.string(),
        args: z.record(z.unknown()),
      }),
    ),
  }),
  z.object({
    type: z.literal('action_result'),
    reply: z.string(),
    actionResults: z.array(
      z.object({
        tool: z.string(),
        success: z.boolean(),
        data: z.unknown().optional(),
        error: z.object({ code: z.string(), message: z.string() }).optional(),
      }),
    ),
  }),
])

const chatErrorResponse = z.object({
  error: z.string(),
})
```

**Response type semantics:**

| Type | When | Frontend behavior |
|------|------|-------------------|
| `text` | Read-only interaction, no writes involved | Display reply normally |
| `confirmation_required` | AI attempted a write tool that was not confirmed | Display reply + confirmation UI showing pending actions |
| `action_result` | One or more confirmed write tools were executed | Display reply + show success/error status for each action |

### 4.4 LLM Integration Interface

```typescript
interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
  isWrite?: boolean
}

export interface ToolContext {
  userId: string
  organizationId: string
  userRole: string
  authType: string
}

export interface ToolExecutor {
  (name: string, args: Record<string, unknown>, context: ToolContext): Promise<string>
}

interface PendingAction {
  tool: string
  args: Record<string, unknown>
}

interface ActionResult {
  tool: string
  success: boolean
  data?: unknown
  error?: { code: string; message: string }
}

interface RunToolLoopResult {
  reply: string
  pendingActions: PendingAction[]
  actionResults: ActionResult[]
}

interface RunToolLoopConfig {
  systemPrompt: string
  userMessage: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  tools: ToolDefinition[]
  executeTool: ToolExecutor
  toolContext: ToolContext
  maxIterations?: number
  confirmedWriteTools?: string[]
}

async function runToolLoop(config: RunToolLoopConfig): Promise<RunToolLoopResult>
```

### 4.5 OpenAI-Compatible API Wire Format

**Request:**
```typescript
POST {LLM_BASE_URL}/chat/completions
Authorization: Bearer {LLM_API_KEY}
Content-Type: application/json

{
  model: string,
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  tool_choice?: 'auto' | 'none' | 'required',
  temperature?: number,
  max_tokens?: number,
}
```

**ChatMessage types:**
```typescript
type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; name: string; content: string }

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}
```

**Response:**
```typescript
{
  choices: [{
    message: {
      role: 'assistant',
      content: string | null,
      tool_calls?: ToolCall[],
    },
    finish_reason: 'stop' | 'tool_calls' | 'length',
  }],
  usage: { prompt_tokens: number, completion_tokens: number, total_tokens: number },
}
```

### 4.6 Tool Result Shapes

**Successful result:**
```typescript
{
  success: true,
  data: Record<string, unknown> | unknown[]
}
```

**Error result:**
```typescript
{
  success: false,
  error: {
    code: 'PERMISSION_DENIED' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR',
    message: string,
  }
}
```

**Pending (intercepted write) result — returned internally to the LLM, not to the client:**
```typescript
{
  success: false,
  pending: true,
  tool: string,
  args: Record<string, unknown>,
}
```

### 4.7 Tool Definitions

```typescript
const searchProductsTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_products',
    description: 'Cari produk berdasarkan kata kunci. Mengembalikan daftar produk dengan paginasi. Gunakan untuk mencari, melihat daftar, atau memfilter produk.',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Kata kunci pencarian (nama produk, deskripsi)' },
        categoryId: { type: 'string', description: 'Filter berdasarkan ID kategori. Kirim "null" untuk produk tanpa kategori.' },
        page: { type: 'integer', description: 'Nomor halaman (mulai dari 1). Default: 1.' },
        pageSize: { type: 'integer', description: 'Jumlah item per halaman (maks 50). Default: 10.' },
        sortBy: { type: 'string', enum: ['name', 'createdAt', 'updatedAt'], description: 'Urutkan berdasarkan field. Default: createdAt.' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Urutan pengurutan. Default: desc.' },
      },
    },
  },
}

const getProductTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_product',
    description: 'Ambil detail satu produk berdasarkan ID. Mengembalikan informasi lengkap termasuk variant dan gambar.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID produk' },
      },
      required: ['id'],
    },
  },
}

const createProductTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_product',
    description: 'Buat produk baru. Memerlukan nama dan slug (akan dibuat otomatis dari nama jika tidak diberikan).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nama produk' },
        slug: { type: 'string', description: 'Slug URL (huruf kecil, strip, garis bawah). Opsional — akan dibuat otomatis dari nama.' },
        description: { type: 'string', description: 'Deskripsi produk. Opsional.' },
        isActive: { type: 'boolean', description: 'Status aktif. Default: true.' },
        categoryId: { type: 'string', description: 'ID kategori. Kirim null untuk tanpa kategori. Opsional.' },
      },
      required: ['name'],
    },
  },
  isWrite: true,
}

const updateProductTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_product',
    description: 'Update produk yang sudah ada. Hanya field yang diberikan yang akan diubah.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID produk yang akan diupdate' },
        name: { type: 'string', description: 'Nama baru produk' },
        slug: { type: 'string', description: 'Slug baru' },
        description: { type: 'string', description: 'Deskripsi baru' },
        isActive: { type: 'boolean', description: 'Status aktif' },
        categoryId: { type: 'string', description: 'ID kategori baru. Kirim null untuk tanpa kategori.' },
      },
      required: ['id'],
    },
  },
  isWrite: true,
}

const deleteProductTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'delete_product',
    description: 'Hapus produk (soft delete). Produk dan semua variant-nya akan dipindahkan ke tempat sampah.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID produk yang akan dihapus' },
      },
      required: ['id'],
    },
  },
  isWrite: true,
}

const restoreProductTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'restore_product',
    description: 'Pulihkan produk yang sudah dihapus dari tempat sampah.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID produk yang akan dipulihkan' },
      },
      required: ['id'],
    },
  },
  isWrite: true,
}

const listCategoriesTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_categories',
    description: 'Daftar semua kategori produk. Gunakan untuk melihat kategori yang tersedia sebelum membuat atau mengkategorikan produk.',
    parameters: {
      type: 'object',
      properties: {
        parentId: { type: 'string', description: 'Filter berdasarkan ID kategori induk. Kirim "null" untuk kategori root.' },
      },
    },
  },
}

const getProductVariantsTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_product_variants',
    description: 'Lihat daftar variant dari sebuah produk. Gunakan untuk melihat detail variant seperti SKU, harga, dan stok.',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'UUID produk' },
      },
      required: ['productId'],
    },
  },
}

const createVariantTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_variant',
    description: 'Buat variant baru untuk sebuah produk. Memerlukan SKU yang unik.',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'UUID produk induk' },
        sku: { type: 'string', description: 'SKU variant (harus unik dalam organisasi)' },
        name: { type: 'string', description: 'Nama variant' },
        price: { type: 'number', description: 'Harga variant' },
        unit: { type: 'string', description: 'Satuan (contoh: pcs, kg, liter). Default: pcs.' },
        isActive: { type: 'boolean', description: 'Status aktif. Default: true.' },
      },
      required: ['productId', 'sku', 'name', 'price'],
    },
  },
  isWrite: true,
}

const updateVariantTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_variant',
    description: 'Update variant yang sudah ada. Hanya field yang diberikan yang akan diubah.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID variant yang akan diupdate' },
        sku: { type: 'string', description: 'SKU baru' },
        name: { type: 'string', description: 'Nama baru' },
        price: { type: 'number', description: 'Harga baru' },
        unit: { type: 'string', description: 'Satuan baru' },
        isActive: { type: 'boolean', description: 'Status aktif' },
      },
      required: ['id'],
    },
  },
  isWrite: true,
}

const deleteVariantTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'delete_variant',
    description: 'Hapus variant (soft delete).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID variant yang akan dihapus' },
      },
      required: ['id'],
    },
  },
  isWrite: true,
}
```

### 4.8 System Prompt

```typescript
const SYSTEM_PROMPT = `
Kamu adalah asisten manajemen inventaris produk yang membantu pengguna mengelola produk, variant, dan kategori. Kamu sangat membantu, responsif, dan selalu memberikan informasi yang akurat.

## Kemampuan Kamu

Kamu dapat melakukan operasi berikut:
- **Mencari produk** — cari berdasarkan nama, deskripsi, atau kategori
- **Melihat detail produk** — lihat info lengkap termasuk variant dan gambar
- **Membuat produk baru** — dengan nama, slug (otomatis), deskripsi, kategori
- **Mengupdate produk** — ubah nama, deskripsi, kategori, status aktif
- **Menghapus produk** — pindahkan ke tempat sampah (soft delete)
- **Memulihkan produk** — kembalikan dari tempat sampah
- **Melihat kategori** — daftar kategori yang tersedia
- **Melihat variant** — daftar variant produk dengan SKU, harga, stok
- **Membuat variant** — tambah variant baru ke produk
- **Mengupdate variant** — ubah SKU, nama, harga, satuan
- **Menghapus variant** — pindahkan ke tempat sampah

## Aturan Penting

1. **Operasi baca (cari, lihat, daftar)**: Langsung eksekusi tanpa konfirmasi.
2. **Operasi tulis (buat, update, hapus, pulihkan)**: Sistem akan secara otomatis mencegah eksekusi operasi tulis dan mengembalikan status "menunggu konfirmasi". Jika kamu menerima hasil tool dengan status pending, jelaskan kepada pengguna operasi apa yang diminta dan beritahu bahwa mereka perlu mengkonfirmasi melalui tombol konfirmasi di UI.
3. **Setelah konfirmasi**: Jika operasi tulis berhasil dieksekusi setelah konfirmasi, laporkan hasilnya kepada pengguna.
4. **Tampilkan data dengan rapi** — gunakan daftar atau tabel yang mudah dibaca.
5. **Jika terjadi error izin**, jelaskan kepada pengguna bahwa mereka tidak memiliki izin yang diperlukan.
6. **Jika produk tidak ditemukan**, informasikan kepada pengguna.
7. **Gunakan bahasa Indonesia** untuk semua respons.
8. **Slug otomatis** — jika pengguna tidak memberikan slug saat membuat produk, slug akan dibuat otomatis dari nama.
`
```

### 4.9 Tool Permission Mapping

```typescript
const TOOL_PERMISSIONS: Record<string, string> = {
  search_products: 'product:view',
  get_product: 'product:view',
  create_product: 'product:create',
  update_product: 'product:update',
  delete_product: 'product:delete',
  restore_product: 'product:delete',
  list_categories: 'productCategory:view',
  get_product_variants: 'productVariant:view',
  create_variant: 'productVariant:create',
  update_variant: 'productVariant:update',
  delete_variant: 'productVariant:delete',
}
```

### 3.15 Audit Logging

- **REQ-054**: All write tool operations (create, update, delete, restore) must call `void logAudit(...)` with `model`, `operation`, `args`, `organizationId`, `userId`, and `authType` — matching the same audit trail as the REST API routes

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `product:view` permission, When they send "cari produk kopi", Then the AI calls `search_products` with `search: 'kopi'` and returns `{ type: 'text', reply: string }`
- **AC-002**: Given an authenticated user with `product:create` permission, When they send "buat produk Kopi Arabica" without `confirmedWriteTools`, Then the AI calls `create_product`, the tool loop intercepts it, and the endpoint returns `{ type: 'confirmation_required', reply: string, pendingActions: [{ tool: 'create_product', args: { name: 'Kopi Arabica' } }] }`
- **AC-003**: Given the user confirms via `confirmedWriteTools: ['create_product']`, Then the AI calls `create_product`, it executes, and the endpoint returns `{ type: 'action_result', reply: string, actionResults: [{ tool: 'create_product', success: true, data: {...} }] }`
- **AC-004**: Given an authenticated user WITHOUT `product:create` permission (including custom roles), When they confirm a product creation via `confirmedWriteTools: ['create_product']`, Then the AI calls `create_product`, the tool executor receives a `PERMISSION_DENIED` error, and the endpoint returns `{ type: 'action_result', reply: string, actionResults: [{ tool: 'create_product', success: false, error: { code: 'PERMISSION_DENIED', message: '...' } }] }`
- **AC-005**: Given an authenticated user, When they send a message with conversation history, Then the AI considers the full conversation context (history placed before current message)
- **AC-006**: Given the LLM provider is unreachable, When a chat request is made, Then the endpoint returns `502` with `{ error: 'AI service unavailable' }`
- **AC-007**: Given a `create_product` call without a `slug`, When the tool executor runs, Then it generates a slug from the product name
- **AC-008**: Given a `search_products` call, When the tool executor runs, Then it returns serialized results with ISO date strings and number prices
- **AC-009**: Given the tool loop exceeds 10 iterations, When `runToolLoop()` is called, Then it throws an error
- **AC-010**: Given a valid `LLM_BASE_URL` pointing to a non-OpenAI provider (e.g., Groq, Ollama), When a chat request is made, Then the integration works without code changes
- **AC-011**: Given conversation history with more than 20 messages, When a chat request is made, Then the endpoint returns `400` with a validation error
- **AC-012**: Given a user message exceeding 2000 characters, When a chat request is made, Then the endpoint returns `400` with a validation error
- **AC-013**: Given any write tool is executed, When the tool executor runs, Then an audit log entry is written via `logAudit()` with the correct model, operation, and args
- **AC-014**: Given `runToolLoop()` intercepts a write tool, When the tool loop returns, Then `pendingActions` contains the exact tool name and arguments from the intercepted call
- **AC-015**: Given `confirmedWriteTools` contains a tool name, When `runToolLoop()` processes that write tool, Then the tool is executed and the result is tracked in `actionResults`
- **AC-016**: Given the endpoint receives a `RunToolLoopResult` with `pendingActions`, When constructing the response, Then the response type is `'confirmation_required'` with the `pendingActions` array

## 6. Test Automation Strategy

### 9.1 Happy Path: Search Products

```
User: "Cari produk dengan kata kunci kopi"
→ [AI calls search_products({ search: 'kopi' })]
→ [Tool returns { success: true, data: [...], meta: {...} }]
Response: { type: 'text', reply: "Saya menemukan 3 produk terkait 'kopi': ..." }
```

### 9.2 Happy Path: Create with Confirmation

```
User: "Buat produk baru bernama Teh Hijau Organik dengan harga Rp 30.000"
Request: { message: "Buat produk baru bernama Teh Hijau Organik", confirmedWriteTools: undefined }
→ [AI calls create_product({ name: 'Teh Hijau Organik' })]
→ [Tool loop intercepts — isWrite: true, not in confirmedWriteTools]
→ [Returns pending result to AI: { success: false, pending: true, tool: 'create_product', args: { name: 'Teh Hijau Organik' } }]
AI: "Baik, saya akan membuat produk baru dengan detail berikut:

     - **Nama**: Teh Hijau Organik
     - **Slug**: teh-hijau-organik (otomatis)
     - **Kategori**: Tidak ada

     Konfirmasi melalui tombol di bawah untuk melanjutkan."
Response: {
  type: 'confirmation_required',
  reply: "Baik, saya akan membuat produk baru ...",
  pendingActions: [{ tool: 'create_product', args: { name: 'Teh Hijau Organik' } }]
}

User confirms via frontend → sends: { message: "Ya, buatkan", confirmedWriteTools: ['create_product'], messages: [...] }
→ [AI calls create_product({ name: 'Teh Hijau Organik' })]
→ [Tool loop allows — isWrite: true, found in confirmedWriteTools]
→ [Executor generates slug: 'teh-hijau-organik', creates product]
→ [Tool returns { success: true, data: { id: '...', name: 'Teh Hijau Organik', ... } }]
Response: {
  type: 'action_result',
  reply: "Produk berhasil dibuat! ID: abc-123. Anda bisa menambahkan variant jika diperlukan.",
  actionResults: [{ tool: 'create_product', success: true, data: { id: '...', name: 'Teh Hijau Organik', ... } }]
}
```

### 9.3 Edge Case: Permission Denied

```
User: "Hapus produk abc-123"
Request: { message: "Hapus produk abc-123", confirmedWriteTools: undefined }
→ [AI calls delete_product({ id: 'abc-123' })]
→ [Tool loop intercepts — isWrite: true, not in confirmedWriteTools]
→ [Returns pending result to AI]
Response: {
  type: 'confirmation_required',
  reply: "Apakah Anda yakin ingin menghapus produk 'Kopi Arabica' (ID: abc-123)? ...",
  pendingActions: [{ tool: 'delete_product', args: { id: 'abc-123' } }]
}

User confirms → sends: { message: "Ya, hapus", confirmedWriteTools: ['delete_product'], messages: [...] }
→ [AI calls delete_product({ id: 'abc-123' })]
→ [Tool executor checks permission → DENIED]
→ [Tool returns { success: false, error: { code: 'PERMISSION_DENIED', message: '...' } }]
Response: {
  type: 'action_result',
  reply: "Maaf, Anda tidak memiliki izin untuk menghapus produk. ...",
  actionResults: [{ tool: 'delete_product', success: false, error: { code: 'PERMISSION_DENIED', message: '...' } }]
}
```

### 9.4 Edge Case: Product Not Found

```
User: "Lihat detail produk non-existent-123"
→ [AI calls get_product({ id: 'non-existent-123' })]
→ [Tool returns { success: false, error: { code: 'NOT_FOUND', message: 'Produk tidak ditemukan' } }]
AI: "Maaf, produk dengan ID 'non-existent-123' tidak ditemukan. Mungkin sudah dihapus atau ID salah."
```

### 9.5 Edge Case: Duplicate SKU

```
User: "Tambahkan variant dengan SKU KOPI-001 ke produk abc-123"
Request: { message: "Tambahkan variant dengan SKU KOPI-001 ke produk abc-123", confirmedWriteTools: ['create_variant'] }
→ [AI calls create_variant({ productId: 'abc-123', sku: 'KOPI-001', ... })]
→ [Tool loop allows — isWrite: true, found in confirmedWriteTools]
→ [Tool executor → Prisma unique constraint violation]
→ [Tool returns { success: false, error: { code: 'VALIDATION_ERROR', message: 'Data sudah digunakan. Pastikan SKU atau slug unik.' } }]
Response: {
  type: 'action_result',
  reply: "Gagal membuat variant. SKU 'KOPI-001' sudah digunakan ...",
  actionResults: [{ tool: 'create_variant', success: false, error: { code: 'VALIDATION_ERROR', message: '...' } }]
}
```

### 9.6 Edge Case: LLM Provider Unreachable

```
User: "Cari produk"
→ [runToolLoop() → fetch to LLM provider fails]
→ [Route returns 502]
Response: { error: 'AI service unavailable' }
```

### 9.7 Edge Case: Auto-Slug Generation

```
User: "Buat produk bernama 'Premium Green Tea - 100g'"
Request: { message: "Buat produk bernama 'Premium Green Tea - 100g'", confirmedWriteTools: ['create_product'] }
→ [AI calls create_product({ name: 'Premium Green Tea - 100g' })]
→ [Tool loop allows — isWrite: true, found in confirmedWriteTools]
→ [Executor generates slug: 'premium-green-tea-100g']
→ [Product created with slug 'premium-green-tea-100g']
Response: { type: 'action_result', reply: "...", actionResults: [{ tool: 'create_product', success: true, ... }] }
```

### 9.8 Edge Case: Conversation History

```
Request: {
  message: "Ya, update harganya jadi 50000",
  messages: [
    { role: 'user', content: 'Cari produk Teh Hijau' },
    { role: 'assistant', content: 'Saya menemukan produk Teh Hijau (ID: abc-123) dengan harga Rp 30.000...' },
    { role: 'user', content: 'Update harganya jadi 50000' },
    { role: 'assistant', content: 'Saya akan mengupdate harga produk Teh Hijau (ID: abc-123) menjadi Rp 50.000. Konfirmasi melalui tombol di bawah.' },
  ],
  confirmedWriteTools: ['update_product']
}
→ [AI understands context and calls update_product({ id: 'abc-123', ... })]
→ [Tool loop allows — isWrite: true, found in confirmedWriteTools]
Response: { type: 'action_result', reply: "...", actionResults: [{ tool: 'update_product', success: true, ... }] }
```

### 9.9 Edge Case: Multiple Pending Actions

```
User: "Buat produk Teh dan tambahkan variant Teh Celup"
Request: { message: "...", confirmedWriteTools: undefined }
→ [AI calls create_product({ name: 'Teh' }) and create_variant({ ... })]
→ [Both intercepted — isWrite: true, not in confirmedWriteTools]
Response: {
  type: 'confirmation_required',
  reply: "Saya akan membuat 1 produk dan 1 variant. Konfirmasi melalui tombol di bawah.",
  pendingActions: [
    { tool: 'create_product', args: { name: 'Teh' } },
    { tool: 'create_variant', args: { productId: '...', sku: '...', name: 'Teh Celup', price: 15000 } },
  ]
}

User confirms → sends: { confirmedWriteTools: ['create_product', 'create_variant'], ... }
→ [Both tools execute in order]
Response: { type: 'action_result', reply: "...", actionResults: [...] }
```

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `integrations/llm.ts` (reusable), `modules/ai/ai.service.ts`, `modules/ai/ai.route.ts`, `modules/ai/ai.test.ts`
2. **Provider agnosticism**: Changing `LLM_BASE_URL` and `LLM_API_KEY` env vars switches providers without code changes
3. **Tool definitions**: All 11 tools defined with correct JSON Schema, descriptions, permission mappings, and `isWrite` flags
4. **RBAC enforcement**: Every tool execution checks permissions before proceeding
5. **Write confirmation (code-level)**: Write tools with `isWrite: true` are intercepted by `runToolLoop()` unless the tool name appears in `confirmedWriteTools`; intercepted writes return pending results and are tracked in `pendingActions`; confirmed writes execute and are tracked in `actionResults`
6. **Structured response**: Endpoint returns discriminated union `ChatResponse` with types `text`, `confirmation_required`, and `action_result`
7. **Serialization**: All tool results serialize Date → ISO string, Decimal → number
8. **Error handling**: Network errors return 502; permission denied returns structured error; not found returns structured error; validation errors returned as structured error
9. **Conversation support**: Client can send up to 20 history messages; AI considers full context
10. **Input validation**: Message max 2000 chars; history max 20 entries
11. **Tool loop safety**: Max 10 iterations; JSON parse errors handled; execution errors handled
12. **OpenAPI docs**: Endpoint tagged `['AI']` with summary and description
13. **Auto-slug**: `create_product` without `slug` generates from name
14. **No `strict: true`**: Tool definitions compatible with all providers
15. **No `additionalProperties: false`**: Tool parameter objects avoid provider-incompatible schema features
16. **`confirmedWriteTools` passthrough**: Request field is passed from route to `runToolLoop()` config

## 11. Changelog (from previous version)

N/A — This is the initial specification. Note: the spec was updated post-implementation to reflect actual design decisions that differed from the original draft.

- **Changed**: `ToolContext` now includes `authType: string` field for audit logging (not in original spec)
- **Changed**: `RunToolLoopConfig` now includes `toolContext: ToolContext` field to thread context to the tool executor
- **Changed**: `ToolExecutor` is now exported as a named interface from `#integrations/llm`
- **Changed**: REQ-028 updated — permission checking uses `auth.api.hasPermission` via a `checkPermission` callback (not `ac` from `#libraries/permissions`) to support custom roles and API keys
- **Changed**: REQ-029 updated — tool executor also receives `authType` for audit logging
- **Changed**: REQ-009 updated — `finish_reason === 'length'` now throws instead of returning truncated output
- **Added**: REQ-054 — All write tool operations must call `logAudit()`
- **Added**: CON-008 — `finish_reason === 'length'` throws an error
- **Added**: DAT-003 — Auth integration dependency for permission checking via callback
- **Changed**: COM-001/COM-002 updated to reflect actual implementation details
- **Changed**: Error messages in Indonesian (`NOT_FOUND` → 'Produk tidak ditemukan', `VALIDATION_ERROR` → 'Data sudah digunakan...')

### v1.1 — Structured Output & Code-Level Write Confirmation

- **Added**: `isWrite?: boolean` to `ToolDefinition` interface — write tools (`create_product`, `update_product`, `delete_product`, `restore_product`, `create_variant`, `update_variant`, `delete_variant`) marked with `isWrite: true`
- **Added**: Code-level write interception in `runToolLoop()` — write tools are intercepted unless tool name appears in `confirmedWriteTools`
- **Added**: `confirmedWriteTools?: string[]` to `RunToolLoopConfig` and `chatRequestDto`
- **Changed**: `runToolLoop()` return type from `Promise<string>` to `Promise<RunToolLoopResult>` with `reply`, `pendingActions`, and `actionResults`
- **Added**: `RunToolLoopResult`, `PendingAction`, `ActionResult` interfaces
- **Changed**: Chat endpoint response from `{ reply: string }` to discriminated union `ChatResponse` with types `text`, `confirmation_required`, `action_result`
- **Added**: Pending tool result shape `{ success: false, pending: true, tool, args }` returned internally to LLM
- **Replaced**: Section 3.6 Write Confirmation — moved from system-prompt-only enforcement to code-level interception (REQ-030 through REQ-038)
- **Updated**: System prompt — removed "JANGAN eksekusi langsung" instruction; AI now explains pending status and asks user to confirm via UI button
- **Updated**: Tool descriptions — removed "Pastikan pengguna sudah mengkonfirmasi" from all write tool descriptions
- **Added**: AC-014, AC-015, AC-016 for structured output behavior
- **Added**: Section 9.9 test scenario for multiple pending actions

## 12. Related Specifications / Further Reading

- Products module spec: `./products/spec-v1.md`
- Auth & permissions: `./auth/spec-v1.md`, `./permissions/spec-v1.md`
- Variants: covered within `./products/spec-v1.md`
- Product categories: covered within `./products/spec-v1.md`
- OpenAI Chat Completions API: https://platform.openai.com/docs/api-reference/chat
- OpenAI Function Calling guide: https://platform.openai.com/docs/guides/function-calling

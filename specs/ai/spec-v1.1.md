---
title: AI Assistant — Frontend Chat UI
version: v1.1
date_created: 2026-04-06
last_updated: 2026-04-06
owner: Frontend Team
feature: ai
tags: [ai, chat, frontend, react, paste-detection, markdown, ui-components]
previous_version: ./spec-v1.md
---

# Introduction

This specification defines the frontend chat interface for the AI Assistant module. It complements [spec-v1.md](./spec-v1.md) which covers the backend LLM integration, tool definitions, RBAC enforcement, and API contract. This document focuses exclusively on the client-side components, route, user interactions, paste detection, and UI states.

The chat UI provides a full-viewport conversational interface where users interact with the AI assistant using natural language. It supports multi-turn conversations, write-operation confirmation flows, action result feedback, and paste detection for long text clips.

## 1. Purpose & Scope

This specification defines:

- **Chat route**: TanStack Router file-based route at `/chat`
- **Chat page component**: Full-viewport conversational UI with state management
- **AI chat input component**: Auto-resizing textarea with paste detection
- **Pasted content card component**: Compact preview card for intercepted pastes
- **Suggested prompts**: Quick-action buttons for common operations
- **Write confirmation UI**: Pending action display with confirm/cancel flow
- **Action result chips**: Visual feedback for executed write operations
- **Navigation integration**: Dashboard sidebar entry for AI chat

**Audience**: Frontend developers building or maintaining the AI chat interface.

**Assumptions**: The reader is familiar with React 19, TanStack Router, Tailwind CSS 4, shadcn/ui patterns, and the backend AI API contract defined in [spec-v1.md](./spec-v1.md).

## 2. Definitions

| Term | Definition |
|------|-----------|
| Chat Message | A single message in the conversation with `{ id, role, content }` shape |
| Pending Confirmation | A write operation intercepted by the backend awaiting user approval |
| Action Result | The outcome of a confirmed and executed write operation |
| Pasted Content | Text content intercepted from paste events exceeding the length threshold |
| Suggested Prompt | A predefined quick-action button shown in the chat empty state |
| Tool Label | A human-readable Indonesian label for an AI tool name |

## 3. Requirements, Constraints & Guidelines

### 3.1 Chat Route

- **REQ-F001**: The chat page MUST be registered as a TanStack file-based route at `/_dashboard/chat/` with URL path `/chat`.
- **REQ-F002**: The route MUST be a child of the `_dashboard` layout route, inheriting authentication and organization context.
- **REQ-F003**: The page MUST use a full-height layout of `h-[calc(100vh-3.5rem)]` to fill the viewport below the dashboard header.

### 3.2 Navigation

- **REQ-F004**: A "Chat AI" navigation item MUST be added to the `MAIN_NAV` array in the dashboard layout, positioned between the POS and Products entries.
- **REQ-F005**: The nav item MUST use the `MessageSquare` icon from lucide-react.
- **REQ-F006**: The nav item MUST be gated by a permission. The current implementation uses `salesOrder` permission which should be reviewed — the AI assistant primarily deals with products/variants/categories.

### 3.3 Chat Page Component

- **REQ-F007**: The page title displayed in the chat header MUST be "Asisten Inventaris".
- **REQ-F008**: The header MUST include a green pulsing dot indicator.
- **REQ-F009**: Conversation history MUST be stored in React state as an array of `ChatMessage` objects: `{ id: string, role: 'user' | 'assistant', content: string }`.
- **REQ-F010**: Message IDs MUST be generated via `crypto.randomUUID()`.
- **REQ-F011**: The message area MUST use `role="log"` and `aria-busy={isLoading}` for accessibility.
- **REQ-F012**: The page MUST auto-scroll to the bottom when new messages arrive or when the loading state changes.

### 3.4 Message Rendering

- **REQ-F013**: User messages MUST be right-aligned with `bg-primary text-primary-foreground` styling, rounded corners with `rounded-br-md`, max-width of 80% on mobile and 60% on desktop, and `whitespace-pre-wrap` for formatting.
- **REQ-F014**: Assistant messages MUST be left-aligned with `bg-muted` styling, max-width of 85% on mobile and 70% on desktop, and rendered using `react-markdown` with `prose prose-sm` classes including dark mode support.
- **REQ-F015**: The `Markdown` component from `react-markdown` MUST be used for rendering assistant message content.

### 3.5 Empty State

- **REQ-F016**: When no messages exist, the chat MUST display a centered empty state with a `MessageSquare` icon and the text "Apa yang bisa saya bantu?".
- **REQ-F017**: The empty state MUST display 4 suggested prompt buttons as defined in Section 4.

### 3.6 Suggested Prompts

- **REQ-F018**: The following suggested prompts MUST be displayed as pill-shaped buttons in the empty state:

| Label | Icon | Message |
|-------|------|---------|
| Cari produk kopi | Search | `Cari produk kopi` |
| Buat produk baru | Plus | `Buat produk baru` |
| Lihat daftar kategori | Tags | `Tampilkan semua kategori produk` |
| Cek stok variant | Package | `Tampilkan variant dan stok produk` |

- **REQ-F019**: Clicking a suggested prompt MUST trigger the same send flow as typing the message manually.

### 3.7 Write Confirmation UI

- **REQ-F020**: When the backend returns `type: 'confirmation_required'`, the frontend MUST display a confirmation panel.
- **REQ-F021**: The confirmation panel MUST render the AI's reply text with Markdown.
- **REQ-F022**: Each pending action MUST be displayed as a card showing the humanized tool name and flattened arguments in a monospace `<pre>` block.
- **REQ-F023**: A "Confirm" button MUST be displayed with the humanized tool name and a `Check` icon. Clicking it MUST send `"Ya, lanjutkan."` as a user message with all pending tool names in `confirmedWriteTools`.
- **REQ-F024**: A "Cancel" button labeled "Batal" with an `X` icon MUST be displayed. Clicking it MUST clear the pending confirmation and add `"Batal."` as a synthetic user message.
- **REQ-F025**: Both confirm and cancel buttons MUST be disabled while a request is in flight.

### 3.8 Action Result Chips

- **REQ-F026**: When the backend returns `type: 'action_result'`, each result MUST be rendered as an inline chip with left margin (`ml-4 md:ml-8`).
- **REQ-F027**: Successful results MUST display a green `Check` icon, the humanized tool name, and the text "Berhasil".
- **REQ-F028**: Failed results MUST display a red `AlertCircle` icon, the humanized tool name, and the error message (or "Gagal" if no message).

### 3.9 Loading State

- **REQ-F029**: While a request is in flight, a loading indicator MUST be displayed with a pulsing `Loader2` spinner and the text "Beruang sedang berpikir...".

### 3.10 Error State

- **REQ-F030**: On API errors, a `sonner` toast notification MUST be shown.
- **REQ-F031**: An inline error message MUST be displayed in a destructive-colored bubble with an `AlertCircle` icon.
- **REQ-F032**: The default error message MUST be "Gagal menghubungi asisten AI. Periksa koneksi internet Anda."

### 3.11 Conversation History

- **REQ-F033**: Before sending a chat request, the frontend MUST slice the message history to the last 20 messages: `messages.slice(-20)`.
- **REQ-F034**: Each message sent to the backend MUST include `{ role, content }` matching the `chatMessageSchema` from the API.
- **REQ-F035**: Cancel confirmation MUST add "Batal." as a synthetic user message to the history.
- **REQ-F036**: Confirm action MUST send "Ya, lanjutkan." as the user message.

### 3.12 AI Chat Input Component

- **REQ-F037**: The `AiChatInput` component MUST accept props: `{ isLoading?: boolean, onSendMessage: (data: { message: string, pastedContent: PastedContent[] }) => void }`.
- **REQ-F038**: The textarea MUST auto-resize based on content up to a maximum height of 384px (`MAX_TEXTAREA_HEIGHT`).
- **REQ-F039**: The textarea MUST have a `maxLength` of 2000 characters.
- **REQ-F040**: Pressing `Enter` (without `Shift`) MUST trigger the send action.
- **REQ-F041**: Pressing `Shift+Enter` MUST insert a newline.
- **REQ-F042**: The send button MUST show a `Loader2` spinner when `isLoading` is true and an `ArrowUp` icon otherwise.
- **REQ-F043**: The send button MUST be disabled when `isLoading` is true or when no content exists.
- **REQ-F044**: The placeholder text MUST be "Cari produk, buat variant, cek stok...".

### 3.13 Paste Detection

- **REQ-F045**: When a paste event contains text >= 300 characters (`PASTE_LENGTH_THRESHOLD`), the default paste MUST be prevented and a `PastedContent` card MUST be created instead.
- **REQ-F046**: A maximum of 5 pasted content cards (`MAX_PASTED_CLIPS`) MAY exist simultaneously. Pastes beyond this limit MUST be ignored (normal paste behavior).
- **REQ-F047**: Each `PastedContent` MUST have `{ id: string, content: string }` where `id` is generated via `crypto.randomUUID()`.
- **REQ-F048**: When a message is sent with pasted content, the full message MUST be constructed by appending each pasted content block separated by double newlines: `${message}\n\n${pastedContent.map(p => p.content).join('\n\n')}`.
- **REQ-F049**: After sending, both the message textarea and pasted content array MUST be cleared.

### 3.14 Pasted Content Card Component

- **REQ-F050**: The `PastedContentCard` component MUST accept `{ content: PastedContent, onRemove: (id: string) => void }` props.
- **REQ-F051**: The card MUST display at a fixed size of `w-28 h-28` (112px x 112px) with `rounded-xl` and `overflow-hidden`.
- **REQ-F052**: The card MUST show truncated text in a monospace font at 10px with `line-clamp-4` and `whitespace-pre-wrap`.
- **REQ-F053**: A "TEKS" badge MUST be displayed at the bottom-left in uppercase at 9px with accent-colored border.
- **REQ-F054**: A remove button with an `X` icon MUST be positioned at the top-right corner, hidden by default (`opacity-0`) and visible on group hover or `focus-visible`.

### 3.15 Tool Name Humanization

- **REQ-F055**: The following tool name labels MUST be used for display in the UI:

| Tool Name | Indonesian Label |
|-----------|-----------------|
| `search_products` | Cari Produk |
| `get_product` | Detail Produk |
| `create_product` | Buat Produk |
| `update_product` | Update Produk |
| `delete_product` | Hapus Produk |
| `restore_product` | Pulihkan Produk |
| `list_categories` | Daftar Kategori |
| `get_product_variants` | Variant Produk |
| `create_variant` | Buat Variant |
| `update_variant` | Update Variant |
| `delete_variant` | Hapus Variant |

- **REQ-F056**: If a tool name is not found in the labels map, the raw tool name MUST be displayed as fallback.

### 3.16 Chat Input Styling

- **REQ-F057**: The chat input MUST use a `[data-chat-input]` attribute for CSS variable scoping.
- **REQ-F058**: The following CSS variables MUST be defined for the chat input in light mode: `--accent: #d97757`, `--accent-hover: #c6613f`, `--accent-foreground: #faf9f5`.
- **REQ-F059**: The following CSS variables MUST be defined for the chat input in dark mode: `--accent: #d2996e`, `--accent-hover: #e5aa7f`, `--accent-foreground: #1f1e1d`.

### 3.17 Constraints

- **CON-F001**: The chat UI is non-streaming — it waits for the full API response before rendering.
- **CON-F002**: Conversation history is client-side only — the server is stateless.
- **CON-F003**: Maximum 20 messages sent per request.
- **CON-F004**: Maximum 2000 characters per message.
- **CON-F005**: Maximum 5 pasted content clips simultaneously.
- **CON-F006**: Paste detection threshold is 300 characters.
- **CON-F007**: The chat UI requires an active authenticated session with organization context.

### 3.18 Guidelines

- **GUD-F001**: Use `react-markdown` for rendering assistant messages to support rich formatting.
- **GUD-F002**: Use Indonesian language for all user-facing strings (titles, labels, prompts, status messages).
- **GUD-F003**: Auto-scroll to bottom should be triggered via a counter state rather than direct DOM manipulation to work with React's rendering cycle.
- **GUD-F004**: The paste detection feature is designed for users pasting product descriptions, supplier data, or other structured text for AI processing.

## 4. Interfaces & Data Contracts

### 4.1 Route Configuration

| Property | Value |
|----------|-------|
| File path | `src/routes/_dashboard/chat/index.tsx` |
| Route ID | `/_dashboard/chat/` |
| URL path | `/chat` |
| Parent route | `_dashboard` layout |

### 4.2 Component Props

#### ChatMessage (internal type)

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}
```

#### PendingConfirmation (internal type)

```typescript
interface PendingConfirmation {
  reply: string
  pendingActions: Array<{
    tool: string
    args: Record<string, unknown>
  }>
}
```

#### AiChatInputProps

```typescript
interface AiChatInputProps {
  isLoading?: boolean
  onSendMessage: (data: {
    message: string
    pastedContent: PastedContent[]
  }) => void
}
```

#### PastedContent

```typescript
interface PastedContent {
  id: string
  content: string
}
```

#### PastedContentCardProps

```typescript
interface PastedContentCardProps {
  content: PastedContent
  onRemove: (id: string) => void
}
```

### 4.3 Component Dependencies

| Component | Dependencies |
|-----------|-------------|
| Chat Page | `@tanstack/react-router`, `#lib/api` (Eden), `react-markdown`, `sonner`, `lucide-react` |
| AiChatInput | `react`, `lucide-react` (`ArrowUp`, `Loader2`), `PastedContentCard` |
| PastedContentCard | `react`, `lucide-react` (`X`) |

### 4.4 Suggested Prompts Data

```typescript
const SUGGESTED_PROMPTS = [
  { label: 'Cari produk kopi', icon: Search, message: 'Cari produk kopi' },
  { label: 'Buat produk baru', icon: Plus, message: 'Buat produk baru' },
  { label: 'Lihat daftar kategori', icon: Tags, message: 'Tampilkan semua kategori produk' },
  { label: 'Cek stok variant', icon: Package, message: 'Tampilkan variant dan stok produk' },
]
```

### 4.5 CSS Variable Scoping

```css
[data-chat-input] {
  --accent: #d97757;
  --accent-hover: #c6613f;
  --accent-foreground: #faf9f5;
}

.dark [data-chat-input] {
  --accent: #d2996e;
  --accent-hover: #e5aa7f;
  --accent-foreground: #1f1e1d;
}
```

## 5. Acceptance Criteria

- **AC-F001**: Given the user navigates to `/chat`, When the page loads, Then the full-viewport chat interface is displayed with the "Asisten Inventaris" header and the empty state with 4 suggested prompt buttons.
- **AC-F002**: Given the chat is empty, When the user clicks a suggested prompt button, Then the prompt message is sent to `POST /ai/chat` and the response is displayed.
- **AC-F003**: Given the user types a message, When they press `Enter`, Then the message is sent and both the user message and assistant response are rendered.
- **AC-F004**: Given the user types a message, When they press `Shift+Enter`, Then a newline is inserted in the textarea.
- **AC-F005**: Given the assistant returns `type: 'text'`, When the response is received, Then the reply is rendered with Markdown formatting in a left-aligned muted bubble.
- **AC-F006**: Given the assistant returns `type: 'confirmation_required'`, When the response is received, Then the pending actions panel is displayed with humanized tool names, args, and Confirm/Cancel buttons.
- **AC-F007**: Given a pending confirmation is displayed, When the user clicks Confirm, Then `"Ya, lanjutkan."` is sent with `confirmedWriteTools` and the action result chips are displayed.
- **AC-F008**: Given a pending confirmation is displayed, When the user clicks Cancel, Then the confirmation is dismissed and `"Batal."` is added to the conversation.
- **AC-F009**: Given the assistant returns `type: 'action_result'`, When the response is received, Then success/failure chips are displayed with appropriate icons and messages.
- **AC-F010**: Given a request is in flight, When the user sees the UI, Then a loading indicator with "Beruang sedang berpikir..." and a spinner is displayed, and the input is disabled.
- **AC-F011**: Given an API error occurs, When the error is caught, Then a sonner toast is shown and an inline error message is displayed.
- **AC-F012**: Given the user pastes text >= 300 characters into the input, When the paste event fires, Then the default paste is prevented and a PastedContentCard is created instead.
- **AC-F013**: Given the user has pasted content cards, When they send a message, Then the pasted content is appended to the message with double newline separators.
- **AC-F014**: Given 5 pasted content cards already exist, When the user pastes more text >= 300 characters, Then the paste behaves normally (no new card is created).
- **AC-F015**: Given the user hovers over a PastedContentCard, When the remove button appears, Then clicking it removes that card from the array.
- **AC-F016**: Given the conversation has more than 20 messages, When a new message is sent, Then only the last 20 messages are included in the API request.

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for components, integration tests for API interaction
- **Frameworks**: Vitest, @testing-library/react, jsdom
- **Test Data Management**: Mock Eden API client responses for all three response types (`text`, `confirmation_required`, `action_result`)
- **Coverage Requirements**: Component rendering, user interactions, paste detection, message formatting

### Test Scenarios

#### F.1 Happy Path: Send Message and Receive Text Response

1. Render ChatPage
2. Type a message in AiChatInput
3. Press Enter
4. Verify `api.ai.chat.post` is called with correct payload
5. Mock return `{ type: 'text', reply: '...' }`
6. Verify user message and assistant message are rendered

#### F.2 Happy Path: Write Confirmation Flow

1. Render ChatPage
2. Send a message that triggers a write tool
3. Mock return `{ type: 'confirmation_required', reply: '...', pendingActions: [...] }`
4. Verify confirmation panel is displayed with tool names and args
5. Click Confirm
6. Verify second API call includes `confirmedWriteTools`
7. Mock return `{ type: 'action_result', reply: '...', actionResults: [...] }`
8. Verify success chips are displayed

#### F.3 Edge Case: Cancel Confirmation

1. Trigger a confirmation_required response
2. Click Cancel
3. Verify pending confirmation is cleared
4. Verify "Batal." is added as a user message

#### F.4 Edge Case: Paste Detection

1. Render AiChatInput
2. Simulate paste event with text of 350 characters
3. Verify `preventDefault()` is called
4. Verify a PastedContentCard is rendered
5. Verify textarea is empty

#### F.5 Edge Case: Paste Below Threshold

1. Render AiChatInput
2. Simulate paste event with text of 50 characters
3. Verify `preventDefault()` is NOT called
4. Verify text is pasted into textarea normally

#### F.6 Edge Case: Max Pasted Clips

1. Create 5 PastedContentCard instances
2. Simulate paste event with text of 500 characters
3. Verify no new card is created
4. Verify text is pasted normally

#### F.7 Edge Case: API Error

1. Send a message
2. Mock API to throw an error
3. Verify error toast is shown
4. Verify inline error message is displayed

#### F.8 Edge Case: Conversation History Trimming

1. Create 25 messages in state
2. Send a new message
3. Verify only the last 20 messages are sent in the API request

## 7. Rationale & Context

The frontend chat UI was designed to provide a conversational interface for the AI product management assistant. Key design decisions:

- **Paste detection**: Users frequently paste product descriptions, supplier data, or CSV content when interacting with the AI. Intercepting pastes >= 300 characters into cards prevents the textarea from becoming unwieldy and gives users visual confirmation of what content will be processed.

- **Suggested prompts**: Reduces cold-start friction by giving users immediate actions to try. The 4 prompts cover the most common use cases: search, create, categories, and variants.

- **Tool name humanization**: Internal tool names like `create_product` are meaningless to end users. The Indonesian labels make the confirmation UI understandable.

- **Non-streaming approach**: Simplifies the implementation and avoids WebSocket/SSE complexity. The loading state with "Beruang sedang berpikir..." provides adequate feedback during the request.

- **Warm accent colors**: The chat input uses custom CSS variables (`--accent: #d97757`) to create a distinctive, warm-toned appearance that differentiates the AI chat from other dashboard areas.

- **Markdown rendering**: The AI assistant returns formatted text including lists, tables, and code blocks. `react-markdown` with `prose` classes provides consistent typography.

## 8. Dependencies & External Integrations

### External Dependencies

- **EXT-F001**: `react-markdown` — Markdown rendering for assistant messages
- **EXT-F002**: `lucide-react` — Icon library for UI elements
- **EXT-F003**: `sonner` — Toast notification library

### Internal Dependencies

- **INT-F001**: `#lib/api` — Eden Treaty client for type-safe API calls to `POST /ai/chat`
- **INT-F002**: `#components/ui/pasted-content-card` — Pasted content preview component
- **INT-F003**: Backend AI API contract (spec-v1.md) — Request/response schemas

### Technology Platform Dependencies

- **PLT-F001**: React 19 — Concurrent features and hooks
- **PLT-F002**: TanStack Router — File-based routing with dashboard layout
- **PLT-F003**: Tailwind CSS 4 — Utility-first styling with `prose` classes from `@tailwindcss/typography`

## 9. Examples & Edge Cases

### Example: Full Confirmation Flow

```
User types: "Buat produk baru bernama Kopi Arabika, harga 50000"

1. POST /ai/chat { message: "Buat produk baru bernama Kopi Arabika, harga 50000", messages: [] }

2. Response: {
     type: "confirmation_required",
     reply: "Saya akan membuat produk baru dengan detail berikut:\n\n- **Nama**: Kopi Arabika\n- **Harga**: Rp 50.000\n\nKonfirmasi untuk melanjutkan?",
     pendingActions: [
       { tool: "create_product", args: { name: "Kopi Arabika", price: 50000, slug: "kopi-arabika" } }
     ]
   }

3. UI displays confirmation panel with:
   - AI reply in Markdown
   - Card: "Buat Produk" with args in <pre> block
   - [Buat Produk ✓] [Batal ✗]

4. User clicks Confirm

5. POST /ai/chat {
     message: "Ya, lanjutkan.",
     messages: [/* previous messages */],
     confirmedWriteTools: ["create_product"]
   }

6. Response: {
     type: "action_result",
     reply: "Produk berhasil dibuat!",
     actionResults: [
       { tool: "create_product", success: true, data: { id: "...", name: "Kopi Arabika" } }
     ]
   }

7. UI displays success chip: ✓ Buat Produk Berhasil
```

### Example: Paste Detection

```
User copies a 500-character product description from a spreadsheet.

1. User presses Ctrl+V in the chat input
2. Paste event fires with 500 characters
3. 500 >= PASTE_LENGTH_THRESHOLD (300) → preventDefault()
4. PastedContentCard appears showing truncated text preview
5. Textarea remains empty

User types: "Buat produk dari deskripsi berikut:"
6. User presses Enter
7. Full message sent: "Buat produk dari deskripsi berikut:\n\n[500-char pasted text]"
8. Both textarea and pasted content are cleared
```

### Edge Case: Empty Message with Pasted Content

```
User pastes 400 characters but does not type any text.

1. PastedContentCard is displayed
2. User presses Enter with empty textarea
3. Send button is disabled (no content) → message is not sent
4. User must type at least one character to send
```

### Edge Case: Rapid Multi-Paste

```
User pastes 6 separate clips of 300+ characters each.

1. First 5 clips → 5 PastedContentCards created
2. 6th clip → MAX_PASTED_CLIPS (5) reached, normal paste behavior
3. Text is inserted into textarea instead
```

## 10. Validation Criteria

1. Chat route is accessible at `/chat` within the dashboard layout
2. Empty state displays 4 suggested prompts with correct labels, icons, and messages
3. User messages render right-aligned with primary styling
4. Assistant messages render left-aligned with Markdown formatting
5. Paste detection intercepts text >= 300 characters into cards
6. Maximum 5 pasted content cards enforced
7. Confirmation panel displays pending actions with humanized tool labels
8. Confirm sends with `confirmedWriteTools` array
9. Cancel dismisses confirmation and adds "Batal." to conversation
10. Action result chips display success/failure correctly
11. Loading state shows spinner with Indonesian text
12. Error state shows toast and inline error message
13. Conversation history is trimmed to last 20 messages before API call
14. Auto-scroll triggers on new messages and state changes
15. Chat input CSS variables are scoped via `[data-chat-input]` attribute
16. All user-facing strings are in Indonesian

## 11. Changelog (from previous version)

- **Added**: Complete frontend chat UI specification (Sections 1-10)
- **Added**: Chat route definition and page layout requirements
- **Added**: AiChatInput component with auto-resize, paste detection, keyboard shortcuts
- **Added**: PastedContentCard component for intercepted paste preview
- **Added**: PastedContent interface and paste detection behavior
- **Added**: 4 suggested prompts for empty state
- **Added**: Tool name humanization labels (Indonesian)
- **Added**: Write confirmation UI (pending actions panel, confirm/cancel flow)
- **Added**: Action result chips (success/failure display)
- **Added**: Loading, error, and empty state requirements
- **Added**: Message rendering requirements (user/assistant bubble styles, Markdown)
- **Added**: CSS variable scoping for chat input accent colors
- **Added**: Navigation entry for "Chat AI" in dashboard sidebar
- **Added**: 8 test scenarios for frontend behavior
- **Rationale**: The backend specification (v1) was backend-only. The frontend implementation introduced significant new components, interactions, and UI states that require their own specification for maintainability and testing.

## 12. Related Specifications / Further Reading

- [spec-v1.md](./spec-v1.md) — Backend AI Assistant specification (LLM integration, tool definitions, API contract)
- [../products/spec-v1.md](../products/spec-v1.md) — Products module specification (referenced by AI tools)
- [../auth/spec-v1.md](../auth/spec-v1.md) — Authentication specification (session and API key support for AI route)
- [../permissions/spec-v1.md](../permissions/spec-v1.md) — RBAC permissions (per-tool permission enforcement)

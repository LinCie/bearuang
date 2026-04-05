# Offline-First Specifications

Summary of all specifications for the offline-first feature domain.

| Version | Date | Description |
|---------|------|-------------|
| [v1](./spec-v1.md) | 2026-04-04 | Initial spec covering Service Worker caching, Dexie read cache, offline mutation queue, and sync pipeline for POS |
| [v2](./spec-v2.md) | 2026-04-04 | Offline auth persistence via TanStack Query, dual-fetch elimination, offline-safe route guards |

## Change Log

- **v2** (2026-04-04): Adds TanStack Query cache persistence for session + permissions queries, `onlineManager` fix for offline startup, replacement of better-auth React hooks with TanStack Query wrappers, offline-safe route guards, and P1 unhandled throw fixes. Motivated by the PWA redirecting to `/signin` when offline (memory-only cache lost on reload).
- **v1** (2026-04-04): Initial specification derived from `plans/offline-first.md`, adjusted to reflect actual implementation state. Covers all three phases (SW, Dexie read cache, mutation queue) as implemented for POS.

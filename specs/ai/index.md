# AI Assistant Specifications

Summary of all specifications for the AI assistant feature domain.

| Version | Date | Description |
|---------|------|-------------|
| [v1](./spec-v1.md) | 2026-04-05 | AI Assistant — Natural language interface for products with OpenAI-compatible tool calling, RBAC enforcement, and write confirmation |
| [v1.1](./spec-v1.1.md) | 2026-04-06 | AI Assistant — Frontend chat UI, paste detection, write confirmation flow, suggested prompts, message rendering |

## Change Log

- **v1.1** (2026-04-06): Added frontend chat UI specification. Chat page route, AiChatInput component with paste detection, PastedContentCard, suggested prompts, write confirmation UI, action result chips, tool name humanization, CSS variable scoping, navigation integration, and 8 test scenarios.
- **v1** (2026-04-05): Initial spec. Reusable LLM integration, 11 product/variant/category tools, per-tool RBAC, write confirmation via system prompt, non-streaming, client-side conversation history.

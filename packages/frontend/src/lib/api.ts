import { treaty } from "@elysiajs/eden"
import type { App } from "backend/src/index"

export const api = treaty<App>("http://localhost:8000")

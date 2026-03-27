import { z } from 'zod'

const errorResponse = z.object({ message: z.string() })

export { errorResponse }

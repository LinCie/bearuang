import { z } from 'zod'

export const sortOrder = z.enum(['asc', 'desc']).default('desc')

export type SortOrder = z.infer<typeof sortOrder>

export const sortQuery = <T extends string>(fields: [T, ...T[]]) =>
  z.object({
    sortBy: z.enum(fields).optional(),
    sortOrder: sortOrder.optional(),
  })

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
})

export type PaginationQuery = z.infer<typeof paginationQuery>

export const paginationMeta = z.object({
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
})

export const paginatedResponse = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    data: z.array(schema),
    meta: paginationMeta,
  })

export type PaginationMeta = z.infer<typeof paginationMeta>

export const buildPaginationMeta = (
  total: number,
  page: number,
  pageSize: number,
): PaginationMeta => {
  const totalPages = Math.ceil(total / pageSize)
  return {
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

export const paginationToSkipTake = (
  page: number,
  pageSize: number,
): { skip: number; take: number } => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
})

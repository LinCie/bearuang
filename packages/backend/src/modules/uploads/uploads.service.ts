import { prisma } from '#integrations/prisma'
import { presignPut, deleteObject, MAX_FILE_SIZE } from '#integrations/s3'

const DEFAULT_ORDER = { createdAt: 'desc' } as const

export const uploadsService = {
  /**
   * Creates a presigned URL for direct S3 upload and a corresponding media record.
   * @param organizationId - Organization identifier.
   * @param input - Upload parameters including filename, contentType, size, and optional purpose.
   * @returns The created media record and a presigned upload URL.
   * @usage Used in uploads.route.ts
   * @sideEffects Creates a new record in the media table.
   */
  async presignUpload(
    organizationId: string,
    input: {
      filename: string
      contentType: string
      size: number
      purpose?: string
    },
  ) {
    if (input.size <= 0 || input.size > MAX_FILE_SIZE) {
      throw new Error(`File size must be between 1 and ${MAX_FILE_SIZE} bytes`)
    }

    const ext = input.filename.includes('.')
      ? input.filename.slice(input.filename.lastIndexOf('.') + 1)
      : ''
    const key = [
      organizationId,
      input.purpose ?? 'uploads',
      `${crypto.randomUUID()}.${ext}`,
    ].join('/')

    const media = await prisma.media.create({
      data: {
        organizationId,
        key,
        filename: input.filename,
        contentType: input.contentType,
        size: input.size,
        purpose: input.purpose,
      },
    })

    const { url } = await presignPut(key, input.contentType)

    return { media, uploadUrl: url }
  },

  /**
   * Confirms an upload by ensuring the media record exists and belongs to the organization.
   * @param organizationId - Organization identifier.
   * @param id - Media identifier.
   * @returns The media record or null if not found.
   * @usage Used in uploads.route.ts
   * @sideEffects None (Read-only)
   */
  async confirmUpload(organizationId: string, id: string) {
    const media = await prisma.media.findFirst({
      where: { id, organizationId },
    })
    if (!media) return null
    return prisma.media.findUniqueOrThrow({ where: { id } })
  },

  /**
   * Lists media items for an organization with optional filtering and pagination.
   * @param organizationId - Organization identifier.
   * @param params - Optional pagination (skip, take) and purpose filter.
   * @returns The paginated list of media records and total count.
   * @usage Used in uploads.route.ts
   * @sideEffects None (Read-only)
   */
  async listMedia(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      purpose?: string
    },
  ) {
    const where = {
      organizationId,
      ...(params?.purpose && { purpose: params.purpose }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.media.findMany({
        where,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: DEFAULT_ORDER,
      }),
      prisma.media.count({ where }),
    ])
    return { data, total }
  },

  /**
   * Retrieves a single media item.
   * @param organizationId - Organization identifier.
   * @param id - Media identifier.
   * @returns The media record or null if not found.
   * @usage Used in uploads.route.ts
   * @sideEffects None (Read-only)
   */
  async getMedia(organizationId: string, id: string) {
    return prisma.media.findFirst({
      where: { id, organizationId },
    })
  },

  /**
   * Deletes a media record and its associated S3 object.
   * @param organizationId - Organization identifier.
   * @param id - Media identifier.
   * @returns The deleted media record or null if not found.
   * @usage Used in uploads.route.ts
   * @sideEffects Deletes a record from the media table and removes the S3 object.
   */
  async deleteMedia(organizationId: string, id: string) {
    const media = await prisma.media.findFirst({
      where: { id, organizationId },
    })
    if (!media) return null
    await deleteObject(media.key)
    return prisma.media.delete({ where: { id } })
  },
}

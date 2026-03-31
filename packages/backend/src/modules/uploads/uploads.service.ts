import { prisma } from '#integrations/prisma'
import { presignPut, deleteObject, MAX_FILE_SIZE } from '#integrations/s3'

export const uploadsService = {
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

  async confirmUpload(organizationId: string, id: string) {
    const media = await prisma.media.findFirst({
      where: { id, organizationId },
    })
    if (!media) return null
    return prisma.media.findUniqueOrThrow({ where: { id } })
  },

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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.media.count({ where }),
    ])
    return { data, total }
  },

  async getMedia(organizationId: string, id: string) {
    return prisma.media.findFirst({
      where: { id, organizationId },
    })
  },

  async deleteMedia(organizationId: string, id: string) {
    const media = await prisma.media.findFirst({
      where: { id, organizationId },
    })
    if (!media) return null
    await deleteObject(media.key)
    return prisma.media.delete({ where: { id } })
  },
}

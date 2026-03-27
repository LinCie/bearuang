import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand } from '@aws-sdk/client-s3'

const MAX_FILE_SIZE = 50 * 1024 * 1024

export const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'auto',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? '',
    secretAccessKey: process.env.S3_SECRET_KEY ?? '',
  },
  forcePathStyle: true,
})

const bucket = () => process.env.S3_BUCKET ?? 'bearuang'

const publicUrlBase = () => process.env.S3_PUBLIC_URL

export function getPublicUrl(key: string): string {
  const base = publicUrlBase()
  if (!base) return ''
  return `${base}/${key}`
}

export async function presignPut(
  key: string,
  contentType: string,
): Promise<{ url: string }> {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
  })

  const url = await getSignedUrl(s3Client, command, { expiresIn: 900 })

  return { url }
}

export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket(),
      Key: key,
    }),
  )
}

export { MAX_FILE_SIZE }

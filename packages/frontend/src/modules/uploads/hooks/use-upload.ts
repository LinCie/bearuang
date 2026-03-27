import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import imageCompression from 'browser-image-compression'
import type {
  Media,
  PresignUploadInput,
} from 'backend/src/modules/uploads/uploads.route'

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
])

const DEFAULT_COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1920,
  initialQuality: 0.8,
  useWebWorker: true,
}

type UploadOptions = {
  maxWidth?: number
  quality?: number
  purpose?: string
}

type UploadResult = {
  upload: (file: File, options?: UploadOptions) => Promise<Media>
  media: Media | null
  error: string | null
  isUploading: boolean
  progress: number
  reset: () => void
}

type PresignResponse = { id: string; key: string; uploadUrl: string }

async function presignUpload(
  input: PresignUploadInput,
): Promise<PresignResponse> {
  const res = await api.uploads.presign.post(input)
  if (!res.data) throw new Error('Failed to get upload URL')
  return res.data as unknown as PresignResponse
}

async function confirmUpload(id: string): Promise<Media> {
  const res = await api.uploads({ id }).confirm.post()
  if (!res.data) throw new Error('Failed to confirm upload')
  return res.data as unknown as Media
}

export function useUpload(): UploadResult {
  const [media, setMedia] = useState<Media | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const reset = useCallback(() => {
    setMedia(null)
    setError(null)
    setIsUploading(false)
    setProgress(0)
  }, [])

  const upload = useCallback(
    async (file: File, options?: UploadOptions): Promise<Media> => {
      setMedia(null)
      setError(null)
      setIsUploading(true)
      setProgress(0)

      try {
        const isImage = IMAGE_TYPES.has(file.type)
        const processedFile = isImage
          ? await imageCompression(file, {
              ...DEFAULT_COMPRESSION_OPTIONS,
              ...(options?.maxWidth && {
                maxWidthOrHeight: options.maxWidth,
              }),
              ...(options?.quality !== undefined && {
                initialQuality: options.quality,
              }),
            })
          : file

        setProgress(20)

        const presignInput: PresignUploadInput = {
          filename: file.name,
          contentType: processedFile.type,
          size: processedFile.size,
          purpose: options?.purpose,
        }

        const { id, uploadUrl } = await presignUpload(presignInput)

        setProgress(40)

        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: processedFile,
          headers: { 'Content-Type': processedFile.type },
        })

        if (!putRes.ok) {
          throw new Error(`Upload failed: ${putRes.status}`)
        }

        setProgress(80)

        const confirmedMedia = await confirmUpload(id)
        setMedia(confirmedMedia)
        setProgress(100)

        return confirmedMedia
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        setError(message)
        throw err
      } finally {
        setIsUploading(false)
      }
    },
    [],
  )

  return { upload, media, error, isUploading, progress, reset }
}

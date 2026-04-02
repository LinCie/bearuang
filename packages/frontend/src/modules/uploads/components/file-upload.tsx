import * as React from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { cn } from '#lib/utils'
import { Button } from '#components/ui/button'
import { useUpload } from '../hooks/use-upload'
import type { Media } from 'backend/src/modules/uploads/uploads.route'

interface FileUploadProps {
  onUploaded: (media: Media) => void
  purpose?: string
  accept?: string
  maxWidth?: number
  quality?: number
  className?: string
  disabled?: boolean
}

function FileUpload({
  onUploaded,
  purpose,
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip',
  maxWidth,
  quality,
  className,
  disabled,
}: FileUploadProps) {
  const { upload, media, error, isUploading, progress, reset } = useUpload()
  const [isDragOver, setIsDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = React.useCallback(
    async (file: File) => {
      try {
        const result = await upload(file, { purpose, maxWidth, quality })
        onUploaded(result)
      } catch {
        // error is already set in state
      }
    },
    [upload, onUploaded, purpose, maxWidth, quality],
  )

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      handleFile(file)
    },
    [handleFile],
  )

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleClick = React.useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ''
    },
    [handleFile],
  )

  const handleRemove = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      reset()
    },
    [reset],
  )

  const isImage = media?.contentType.startsWith('image/')

  return (
    <div className={cn('w-full', className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick()
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
          isUploading && 'pointer-events-none',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : media ? (
          <div className="relative flex items-center gap-3 p-3">
            {isImage ? (
              <img
                src={media.url}
                alt={media.filename}
                className="size-16 rounded-md object-cover"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-md bg-muted">
                <Upload className="size-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col overflow-hidden">
              <p className="truncate text-sm font-medium">{media.filename}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(media.size)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleRemove}
              className="ml-auto shrink-0"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-4">
            <Upload className="size-8 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium">
                Drop a file here or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Max 50MB per file
              </p>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export { FileUpload }

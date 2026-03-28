import * as React from 'react'
import { Upload, X, Loader2, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useUpload } from '@/modules/uploads/hooks/use-upload'
import type { Media } from 'backend/src/modules/uploads/uploads.route'

type ExistingImage = {
  id: string
  url: string
  altText?: string | null
}

type PendingImage = {
  status: 'uploading' | 'done' | 'error'
  file: File
  media?: Media
  error?: string
}

type SortableItem =
  | { kind: 'existing'; image: ExistingImage }
  | { kind: 'pending'; pending: PendingImage; index: number }

interface MultiFileUploadProps {
  /** Images already persisted on the server. */
  existingImages: ExistingImage[]
  /** Callback when an existing image is removed. */
  onRemoveExisting: (imageId: string) => void
  /** Callback when existing images are reordered. */
  onReorderExisting?: (imageIds: string[]) => void
  /** Files currently being uploaded or pending. */
  pendingImages: PendingImage[]
  /** Setter for pending images state. */
  onSetPendingImages: React.Dispatch<React.SetStateAction<PendingImage[]>>
  /** Upload purpose tag. Defaults to "product-image". */
  purpose?: string
  /** Accepted file types. Defaults to "image/*". */
  accept?: string
  /** Label text shown above the dropzone. Defaults to "Foto Produk". */
  label?: string
  /** Whether the uploader is disabled. */
  disabled?: boolean
  /** Maximum number of files allowed. Defaults to 5. */
  maxFiles?: number
  /** Maximum file size in MB. Defaults to 4. */
  maxSize?: number
  /** ClassName for the root element. */
  className?: string
}

export type { PendingImage }

function SortableImageThumb({
  item,
  previewUrl,
  disabled,
  onRemove,
  onRetry,
  isUploading,
}: {
  item: SortableItem
  previewUrl?: string
  disabled: boolean
  onRemove: () => void
  onRetry?: () => void
  isUploading?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id:
      item.kind === 'existing'
        ? `existing-${item.image.id}`
        : `pending-${item.index}`,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  const isExisting = item.kind === 'existing'
  const isError = !isExisting && item.pending.status === 'error'
  const isPendingUploading = !isExisting && item.pending.status === 'uploading'
  const isPendingDone = !isExisting && item.pending.status === 'done'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group aspect-square rounded-lg overflow-hidden border bg-muted',
        isExisting
          ? 'border-border'
          : isError
            ? 'border-destructive/50'
            : 'border-border',
      )}
    >
      <img
        src={isExisting ? item.image.url : (previewUrl ?? '')}
        alt={isExisting ? (item.image.altText ?? '') : item.pending.file.name}
        className="object-cover w-full h-full pointer-events-none select-none"
        draggable={false}
      />
      {!isUploading && (
        <button
          type="button"
          className={cn(
            'absolute top-1 left-1 h-6 w-6 flex items-center justify-center rounded-md',
            'bg-black/30 text-white/70 hover:text-white hover:bg-black/50',
            'opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing',
          )}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      {isPendingUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        </div>
      )}
      {isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 gap-1">
          <p className="text-xs text-white">Gagal</p>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-6 w-6 rounded-full shadow-sm"
            onClick={(e) => {
              e.stopPropagation()
              onRetry?.()
            }}
            disabled={disabled}
            aria-label={`Retry ${item.pending.file.name}`}
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {isPendingDone && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          disabled={disabled}
          aria-label={`Remove ${item.pending.file.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

/**
 * A reusable multi-file uploader with drag-and-drop, server upload progress,
 * existing image management, sortable reordering, and animations.
 */
export const MultiFileUpload = React.forwardRef<
  HTMLDivElement,
  MultiFileUploadProps
>(
  (
    {
      existingImages,
      onRemoveExisting,
      onReorderExisting,
      pendingImages,
      onSetPendingImages,
      purpose = 'product-image',
      accept = 'image/*',
      label = 'Foto Produk',
      disabled = false,
      maxFiles = 5,
      maxSize = 4,
      className,
      ...props
    },
    ref,
  ) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [isDragging, setIsDragging] = React.useState(false)
    const { upload: uploadFile } = useUpload()

    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: { distance: 5 },
      }),
      useSensor(KeyboardSensor),
    )

    const [orderedExistingIds, setOrderedExistingIds] = React.useState<
      string[]
    >(() => existingImages.map((img) => img.id))

    const existingIdsRef = React.useRef<string[]>(
      existingImages.map((img) => img.id),
    )

    React.useEffect(() => {
      const newIds = existingImages.map((img) => img.id)
      if (
        newIds.length !== existingIdsRef.current.length ||
        newIds.some((id, i) => id !== existingIdsRef.current[i])
      ) {
        existingIdsRef.current = newIds
        setOrderedExistingIds(newIds)
      }
    }, [existingImages])

    const pendingPreviewUrls = React.useMemo(
      () => pendingImages.map((p) => URL.createObjectURL(p.file)),
      [pendingImages],
    )

    React.useEffect(() => {
      return () => {
        pendingPreviewUrls.forEach((url) => URL.revokeObjectURL(url))
      }
    }, [pendingPreviewUrls])

    const sortableIds = React.useMemo(
      () => [
        ...orderedExistingIds.map((id) => `existing-${id}`),
        ...pendingImages.map((_, i) => `pending-${i}`),
      ],
      [orderedExistingIds, pendingImages.length],
    )

    const handleFiles = React.useCallback(
      (files: FileList | File[]) => {
        const fileArray = Array.from(files)
        const uniqueNewFiles = fileArray.filter(
          (newFile) =>
            !pendingImages.some(
              (p) => p.file.name === newFile.name && p.status !== 'error',
            ),
        )

        const capped = uniqueNewFiles.slice(
          0,
          maxFiles - existingImages.length - pendingImages.length,
        )

        const newPending: PendingImage[] = capped.map((file) => ({
          status: 'uploading' as const,
          file,
        }))
        onSetPendingImages((prev) => [...prev, ...newPending])

        for (let i = 0; i < capped.length; i++) {
          const idx = i
          ;(async () => {
            try {
              const media = await uploadFile(capped[idx], { purpose })
              onSetPendingImages((prev) => {
                const baseIdx = prev.length - capped.length + idx
                return prev.map((p, j) =>
                  j === baseIdx ? { ...p, status: 'done' as const, media } : p,
                )
              })
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Upload gagal'
              onSetPendingImages((prev) => {
                const baseIdx = prev.length - capped.length + idx
                return prev.map((p, j) =>
                  j === baseIdx
                    ? { ...p, status: 'error' as const, error: msg }
                    : p,
                )
              })
            }
          })()
        }
      },
      [
        uploadFile,
        purpose,
        onSetPendingImages,
        pendingImages,
        existingImages.length,
        maxFiles,
      ],
    )

    const handleRemovePending = React.useCallback(
      (index: number) => {
        onSetPendingImages((prev) => prev.filter((_, i) => i !== index))
      },
      [onSetPendingImages],
    )

    const handleRetryPending = React.useCallback(
      async (index: number) => {
        const item = pendingImages[index]
        onSetPendingImages((prev) =>
          prev.map((p, i) =>
            i === index
              ? { ...p, status: 'uploading' as const, error: undefined }
              : p,
          ),
        )
        try {
          const media = await uploadFile(item.file, { purpose })
          onSetPendingImages((prev) =>
            prev.map((p, i) =>
              i === index ? { ...p, status: 'done' as const, media } : p,
            ),
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload gagal'
          onSetPendingImages((prev) =>
            prev.map((p, i) =>
              i === index ? { ...p, status: 'error' as const, error: msg } : p,
            ),
          )
        }
      },
      [pendingImages, uploadFile, purpose, onSetPendingImages],
    )

    const handleSortEnd = React.useCallback(
      (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        setOrderedExistingIds((prev) => {
          const oldIndex = prev.indexOf(
            String(active.id).replace('existing-', ''),
          )
          const newIndex = prev.indexOf(
            String(over.id).replace('existing-', ''),
          )

          if (oldIndex === -1 || newIndex === -1) return prev

          const reordered = arrayMove(prev, oldIndex, newIndex)
          onReorderExisting?.(reordered)
          return reordered
        })

        onSetPendingImages((prev) => {
          const activeKey = String(active.id)
          const overKey = String(over.id)
          const activeIdx = activeKey.startsWith('pending-')
            ? Number(activeKey.replace('pending-', ''))
            : -1
          const overIdx = overKey.startsWith('pending-')
            ? Number(overKey.replace('pending-', ''))
            : -1

          if (activeIdx === -1 || overIdx === -1) return prev
          return arrayMove(prev, activeIdx, overIdx)
        })
      },
      [onReorderExisting, onSetPendingImages],
    )

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (!disabled && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    }

    const hasAnyUploading = pendingImages.some((p) => p.status === 'uploading')
    const totalImages = existingImages.length + pendingImages.length

    return (
      <div ref={ref} className={cn('space-y-4', className)} {...props}>
        {label && <label className="font-medium">{label}</label>}

        {totalImages > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSortEnd}
          >
            <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 gap-3">
                {orderedExistingIds
                  .map((id) => existingImages.find((img) => img.id === id))
                  .filter((img): img is ExistingImage => img != null)
                  .map((image) => (
                    <SortableImageThumb
                      key={`existing-${image.id}`}
                      item={{ kind: 'existing', image }}
                      disabled={disabled}
                      onRemove={() => onRemoveExisting(image.id)}
                    />
                  ))}
                {pendingImages.map((pending, index) => (
                  <SortableImageThumb
                    key={`pending-${index}`}
                    item={{ kind: 'pending', pending, index }}
                    previewUrl={pendingPreviewUrls[index]}
                    disabled={disabled}
                    onRemove={() => handleRemovePending(index)}
                    onRetry={() => handleRetryPending(index)}
                    isUploading={pending.status === 'uploading'}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-300',
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-muted-foreground/30 bg-transparent',
            disabled && 'pointer-events-none opacity-50',
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          aria-label="Image uploader dropzone"
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <div className="flex flex-col items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-full"
              disabled={disabled}
            >
              <Upload className="h-6 w-6" />
            </Button>
            <div>
              <p className="font-medium">Klik atau seret foto ke sini</p>
              <p className="text-sm text-muted-foreground">
                JPG, PNG, WEBP. Max {maxSize}MB.
              </p>
            </div>
          </div>
        </div>

        {totalImages > 0 && (
          <p className="text-sm text-muted-foreground">
            {existingImages.length} foto tersimpan
            {pendingImages.filter((p) => p.status === 'done').length > 0 &&
              ` + ${pendingImages.filter((p) => p.status === 'done').length} baru`}
            {hasAnyUploading && ' (mengunggah...)'}
          </p>
        )}
      </div>
    )
  },
)

MultiFileUpload.displayName = 'MultiFileUpload'

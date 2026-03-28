import * as React from 'react'
import { Portal } from 'radix-ui'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { XIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

interface GalleryImage {
  src: string
  alt: string
  caption?: string
}

interface ImageGalleryProps {
  images: readonly GalleryImage[]
  columns?: 2 | 3 | 4
  gap?: 'sm' | 'md' | 'lg'
  aspectRatio?: 'square' | 'video' | 'landscape'
  className?: string
}

function ImageGallery({
  images,
  columns = 3,
  gap = 'md',
  aspectRatio = 'landscape',
  className,
}: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (activeIndex === null) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setActiveIndex(null)
      } else if (e.key === 'ArrowRight') {
        setActiveIndex((prev) =>
          prev !== null ? (prev + 1) % images.length : null,
        )
      } else if (e.key === 'ArrowLeft') {
        setActiveIndex((prev) =>
          prev !== null ? (prev - 1 + images.length) % images.length : null,
        )
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [activeIndex, images.length])

  const next = React.useCallback(() => {
    setActiveIndex((idx) => (idx !== null ? (idx + 1) % images.length : null))
  }, [images.length])

  const prev = React.useCallback(() => {
    setActiveIndex((idx) =>
      idx !== null ? (idx - 1 + images.length) % images.length : null,
    )
  }, [images.length])

  const colClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  }[columns]

  const gapClass = { sm: 'gap-1.5', md: 'gap-3', lg: 'gap-5' }[gap]

  const aspectClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    landscape: 'aspect-[4/3]',
  }[aspectRatio]

  return (
    <>
      <div
        data-slot="image-gallery"
        className={cn('grid', colClass, gapClass, className)}
      >
        {images.map((image, index) => (
          <button
            key={`${image.src}-${index}`}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={cn(
              'group relative cursor-pointer overflow-hidden rounded-lg',
              'ring-1 ring-foreground/10',
              aspectClass,
              'transition-shadow duration-200 hover:ring-foreground/20 hover:shadow-md',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <img
              src={image.src}
              alt={image.alt}
              loading="lazy"
              decoding="async"
              className={cn(
                'h-full w-full object-cover transition-transform duration-300',
                'group-hover:scale-[1.03]',
              )}
            />
            {image.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2.5 pt-8">
                <span className="text-xs font-medium text-white/90 leading-tight">
                  {image.caption}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      <Portal.Root container={document.body}>
        {activeIndex !== null && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Image ${activeIndex + 1} of ${images.length}`}
            className={cn(
              'fixed inset-0 z-50 flex items-center justify-center',
              'bg-black/80 supports-backdrop-filter:backdrop-blur-sm',
            )}
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveIndex(null)
            }}
          >
            <div className="relative flex size-full max-w-[90vw] max-h-[90vh] items-center justify-center">
              {images.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={prev}
                  className={cn(
                    'absolute left-3 z-10 rounded-full',
                    'bg-white/10 text-white hover:bg-white/20 hover:text-white',
                    'focus-visible:ring-white/50',
                  )}
                  aria-label="Previous image"
                >
                  <ChevronLeftIcon className="size-5" />
                </Button>
              )}

              <img
                key={images[activeIndex].src}
                src={images[activeIndex].src}
                alt={images[activeIndex].alt}
                className={cn(
                  'max-h-[85vh] max-w-full rounded-lg object-contain',
                  'shadow-2xl',
                )}
              />

              {images.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={next}
                  className={cn(
                    'absolute right-3 z-10 rounded-full',
                    'bg-white/10 text-white hover:bg-white/20 hover:text-white',
                    'focus-visible:ring-white/50',
                  )}
                  aria-label="Next image"
                >
                  <ChevronRightIcon className="size-5" />
                </Button>
              )}

              <div className="absolute top-3 right-3 flex items-center gap-2">
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white/80">
                  {activeIndex + 1} / {images.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setActiveIndex(null)}
                  className={cn(
                    'rounded-full',
                    'bg-white/10 text-white hover:bg-white/20 hover:text-white',
                    'focus-visible:ring-white/50',
                  )}
                  aria-label="Close"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>

              {images[activeIndex].caption && (
                <div className="absolute bottom-3 left-3 right-3 text-center">
                  <span className="inline-block rounded-full bg-white/15 px-3 py-1.5 text-sm text-white/90">
                    {images[activeIndex].caption}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </Portal.Root>
    </>
  )
}

export { ImageGallery }
export type { GalleryImage, ImageGalleryProps }

import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { Plus } from 'lucide-react'
import {
  useProduct,
  useUpdateProduct,
  useDeleteProduct,
  useProductVariants,
  useCreateVariant,
  useUpdateVariant,
  useDeleteVariant,
  useRestoreVariant,
  useProductTrashedVariants,
  useAddProductImage,
  useRemoveProductImage,
  useReorderProductImages,
  useAddVariantImage,
  useRemoveVariantImage,
  ProductDetailHeader,
  EmptyVariantsState,
  VariantsTable,
  TrashedVariantsTable,
  ProductLoadingState,
  ProductErrorState,
  ProductFormSheet,
  VariantFormSheet,
  DeleteDialog,
} from '#modules/products/index'
import type {
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  ProductVariant,
} from '#modules/products/index'
import { Button } from '#components/ui/button'
import { ImageGallery } from '#components/ui/image-gallery'
import type { GalleryImage } from '#components/ui/image-gallery'
import { useHasPermission } from '#lib/use-permissions'
import { toast } from 'sonner'

export const Route = createFileRoute('/_dashboard/products/$productId')({
  component: ProductDetailPage,
})

// ─── Page Component ───────────────────────────────────────────

function ProductDetailPage() {
  const { productId } = Route.useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: product, isLoading, isError } = useProduct(productId)
  const { data: variantsData } = useProductVariants(productId)
  const { data: trashedVariants } = useProductTrashedVariants(productId)

  const variants: ProductVariant[] = variantsData ?? product?.variants ?? []

  // Mutations
  const createVariant = useCreateVariant(productId)
  const updateVariant = useUpdateVariant()
  const deleteVariant = useDeleteVariant()
  const restoreVariant = useRestoreVariant()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
  const addProductImage = useAddProductImage(productId)
  const removeProductImage = useRemoveProductImage(productId)
  const reorderProductImages = useReorderProductImages(productId)
  const addVariantImage = useAddVariantImage()
  const removeVariantImage = useRemoveVariantImage()

  const canCreate = useHasPermission('product:create')
  const canUpdate = useHasPermission('product:update')

  // Sheet state (create / edit variant)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingVariant, setEditingVariant] =
    React.useState<ProductVariant | null>(null)

  // Delete dialog state (variant)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingVariant, setDeletingVariant] =
    React.useState<ProductVariant | null>(null)

  // Product edit sheet state
  const [productSheetOpen, setProductSheetOpen] = React.useState(false)

  // Product delete dialog state
  const [productDeleteDialogOpen, setProductDeleteDialogOpen] =
    React.useState(false)

  // ─── Handlers ──────────────────────────────────────────────

  const handleCreate = React.useCallback(() => {
    setEditingVariant(null)
    setSheetOpen(true)
  }, [])

  const handleEdit = React.useCallback((variant: ProductVariant) => {
    setEditingVariant(variant)
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback((variant: ProductVariant) => {
    setDeletingVariant(variant)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deletingVariant) return
    await deleteVariant.mutateAsync(deletingVariant.id)
    setDeleteDialogOpen(false)
    setDeletingVariant(null)
  }, [deletingVariant, deleteVariant])

  // Product edit handlers
  const handleProductEdit = React.useCallback(() => {
    setProductSheetOpen(true)
  }, [])

  const handleProductDeleteClick = React.useCallback(() => {
    setProductDeleteDialogOpen(true)
  }, [])

  const handleProductDeleteConfirm = React.useCallback(async () => {
    if (!product) return
    await deleteProduct.mutateAsync(product.id)
    setProductDeleteDialogOpen(false)
    router.navigate({ to: '/products' })
  }, [product, deleteProduct, router])

  const handleRestoreVariant = React.useCallback(
    async (variant: ProductVariant) => {
      try {
        await restoreVariant.mutateAsync(variant.id)
        toast.success(`Varian "${variant.name}" telah dipulihkan`)
      } catch (error) {
        toast.error('Gagal memulihkan varian')
      }
    },
    [restoreVariant],
  )

  async function handleProductSubmit(values: {
    name: string
    slug: string
    description: string
    categoryId: string | null
    isActive: boolean
    pendingImages: { id: string }[]
    removedImageIds: string[]
    reorderedImageIds?: string[]
  }) {
    if (!product) return
    const input: UpdateProductInput & { id: string } = {
      id: product.id,
      name: values.name,
      slug: values.slug,
      description: values.description || undefined,
      categoryId: values.categoryId,
      isActive: values.isActive,
    }
    await updateProduct.mutateAsync(input)

    for (const imageId of values.removedImageIds) {
      await removeProductImage.mutateAsync(imageId)
    }
    for (const media of values.pendingImages) {
      await addProductImage.mutateAsync({ mediaId: media.id })
    }
    if (values.reorderedImageIds && values.reorderedImageIds.length > 0) {
      await reorderProductImages.mutateAsync(values.reorderedImageIds)
    }

    setProductSheetOpen(false)
  }

  async function handleSubmit(values: {
    sku: string
    name: string
    price: number
    unit?: string
    isActive: boolean
    pendingImages: { id: string }[]
    removedImageIds: string[]
  }) {
    if (editingVariant) {
      const input: UpdateVariantInput & { id: string } = {
        id: editingVariant.id,
        sku: values.sku,
        name: values.name,
        price: values.price,
        unit: values.unit || undefined,
        isActive: values.isActive,
      }
      await updateVariant.mutateAsync(input)

      for (const imageId of values.removedImageIds) {
        await removeVariantImage.mutateAsync({
          variantId: editingVariant.id,
          imageId,
        })
      }
      for (const media of values.pendingImages) {
        await addVariantImage.mutateAsync({
          variantId: editingVariant.id,
          mediaId: media.id,
        })
      }
    } else {
      const input: CreateVariantInput = {
        sku: values.sku,
        name: values.name,
        price: values.price,
        unit: values.unit || undefined,
        isActive: values.isActive,
      }
      const created = await createVariant.mutateAsync(input)

      for (const media of values.pendingImages) {
        await addVariantImage.mutateAsync({
          variantId: created.id,
          mediaId: media.id,
        })
      }
    }
    setSheetOpen(false)
    setEditingVariant(null)
    if (product) {
      queryClient.invalidateQueries({
        queryKey: ['products', 'detail', product.id],
      })
      queryClient.invalidateQueries({
        queryKey: ['variants', 'byProduct', productId],
      })
    }
  }

  // ─── Loading State ─────────────────────────────────────────

  if (isLoading) {
    return <ProductLoadingState />
  }

  // ─── Error State ───────────────────────────────────────────

  if (isError || !product) {
    return <ProductErrorState />
  }

  // ─── Main Render ───────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-8 lg:gap-10 mt-6 mb-20 mx-auto">
        {/* Header Section */}
        <ProductDetailHeader
          product={product}
          onEdit={handleProductEdit}
          onDelete={handleProductDeleteClick}
        />

        {/* Content Section */}
        <div className="flex flex-col gap-12 lg:pl-14">
          {/* Description */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Deskripsi Produk
            </h2>
            {product.description ? (
              <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap max-w-3xl">
                {product.description}
              </p>
            ) : (
              <div className="flex flex-col gap-3 py-4">
                <p className="text-muted-foreground text-sm">
                  Belum ada deskripsi untuk produk ini.
                </p>
                {canUpdate && (
                  <button
                    onClick={handleProductEdit}
                    className="text-sm text-amber-700 hover:text-amber-800 font-medium self-start transition-colors"
                  >
                    Tambahkan deskripsi →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Images */}
          {product.images.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Gambar Produk
              </h2>
              <ImageGallery
                images={[...product.images]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map(
                    (img): GalleryImage => ({
                      src: img.media.url,
                      alt: img.altText ?? img.media.filename,
                    }),
                  )}
                columns={3}
                aspectRatio="square"
              />
            </div>
          )}

          {/* Variants Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-foreground">
                Varian ({variants.length})
              </h2>
              {canCreate && (
                <Button
                  size="sm"
                  onClick={handleCreate}
                  className="shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Tambah Varian
                </Button>
              )}
            </div>

            <div className="-mx-4 sm:mx-0">
              {variants.length === 0 ? (
                <EmptyVariantsState onCreate={handleCreate} />
              ) : (
                <VariantsTable
                  variants={variants}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                />
              )}
            </div>

            {trashedVariants && trashedVariants.length > 0 && (
              <TrashedVariantsTable
                variants={trashedVariants}
                onRestore={handleRestoreVariant}
                isRestorePending={restoreVariant.isPending}
              />
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit Sheet */}
      <VariantFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setEditingVariant(null)
        }}
        variant={editingVariant}
        onSubmit={handleSubmit}
        isPending={createVariant.isPending || updateVariant.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus varian?"
        description={
          <>
            Anda akan menghapus varian{' '}
            <span className="font-medium text-foreground">
              {deletingVariant?.name}
            </span>{' '}
            ({deletingVariant?.sku}). Varian ini akan dipindahkan ke tempat
            sampah dan dapat dipulihkan nanti.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteVariant.isPending}
        confirmLabel="Ya, Hapus Varian"
      />

      {/* Product Edit Sheet */}
      <ProductFormSheet
        open={productSheetOpen}
        onOpenChange={setProductSheetOpen}
        product={product}
        onSubmit={handleProductSubmit}
        isPending={updateProduct.isPending}
      />

      {/* Product Delete Confirmation Dialog */}
      <DeleteDialog
        open={productDeleteDialogOpen}
        onOpenChange={setProductDeleteDialogOpen}
        title="Hapus dari katalog?"
        description={
          <>
            Anda akan menghapus{' '}
            <span className="font-medium text-foreground">{product.name}</span>.
            Produk ini akan dipindahkan ke tempat sampah dan dapat dipulihkan
            nanti.
          </>
        }
        onConfirm={handleProductDeleteConfirm}
        isPending={deleteProduct.isPending}
        confirmLabel="Ya, Hapus Produk"
      />
    </>
  )
}

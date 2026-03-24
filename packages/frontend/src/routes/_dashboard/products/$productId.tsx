import { createFileRoute, useRouter } from '@tanstack/react-router'
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
  type UpdateProductInput,
  type CreateVariantInput,
  type UpdateVariantInput,
} from '@/modules/products'
import {
  ProductDetailHeader,
  EmptyVariantsState,
  VariantsTable,
  ProductLoadingState,
  ProductErrorState,
  ProductFormSheet,
  VariantFormSheet,
  DeleteDialog,
} from '@/modules/products'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_dashboard/products/$productId')({
  component: ProductDetailPage,
})

// ─── Types ────────────────────────────────────────────────────

interface Variant {
  id: string
  productId: string
  sku: string
  name: string
  price: number
  stock: number
  unit: string
  attributes: Record<string, unknown>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ─── Page Component ───────────────────────────────────────────

function ProductDetailPage() {
  const { productId } = Route.useParams()
  const router = useRouter()
  const { data: product, isLoading, isError } = useProduct(productId)
  const { data: variantsData } = useProductVariants(productId)

  const variants: Variant[] = (variantsData ??
    product?.variants ??
    []) as Variant[]

  // Mutations
  const createVariant = useCreateVariant(productId)
  const updateVariant = useUpdateVariant()
  const deleteVariant = useDeleteVariant()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  // Sheet state (create / edit variant)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingVariant, setEditingVariant] = React.useState<Variant | null>(
    null,
  )

  // Delete dialog state (variant)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingVariant, setDeletingVariant] = React.useState<Variant | null>(
    null,
  )

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

  const handleEdit = React.useCallback((variant: Variant) => {
    setEditingVariant(variant)
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback((variant: Variant) => {
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

  async function handleProductSubmit(values: {
    name: string
    slug: string
    description: string
    isActive: boolean
  }) {
    if (!product) return
    const input: UpdateProductInput & { id: string } = {
      id: product.id,
      name: values.name,
      slug: values.slug,
      description: values.description || undefined,
      isActive: values.isActive,
    }
    await updateProduct.mutateAsync(input)
    setProductSheetOpen(false)
  }

  async function handleSubmit(values: {
    sku: string
    name: string
    price: number
    unit?: string
    isActive: boolean
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
    } else {
      const input: CreateVariantInput = {
        sku: values.sku,
        name: values.name,
        price: values.price,
        unit: values.unit || undefined,
        isActive: values.isActive,
      }
      await createVariant.mutateAsync(input)
    }
    setSheetOpen(false)
    setEditingVariant(null)
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
          {product.description && (
            <p className="text-[15px] text-foreground/80 leading-relaxed whitespace-pre-wrap max-w-3xl">
              {product.description}
            </p>
          )}

          {/* Divider */}
          {product.description && <div className="w-full h-px bg-border/20" />}

          {/* Variants Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-foreground">
                Varian ({variants.length})
              </h2>
              <Button
                size="sm"
                onClick={handleCreate}
                className="shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Tambah Varian
              </Button>
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
            ({deletingVariant?.sku}). Varian ini akan dihapus dan tidak bisa
            dikembalikan.
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
            <span className="font-medium text-foreground">{product?.name}</span>
            . Produk ini akan hilang selamanya dan tidak bisa dikembalikan.
          </>
        }
        onConfirm={handleProductDeleteConfirm}
        isPending={deleteProduct.isPending}
        confirmLabel="Ya, Hapus Produk"
      />
    </>
  )
}

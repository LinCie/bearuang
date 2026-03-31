import { createFileRoute, useRouter } from '@tanstack/react-router'
import * as React from 'react'
import {
  useProductCategory,
  useUpdateProductCategory,
  useDeleteProductCategory,
  ProductCategoryDetailHeader,
  ProductCategoryFormSheet,
  ProductCategoryLoadingState,
  ProductCategoryErrorState,
  CategoryProductsTable,
  DeleteDialog,
} from '@/modules/product-categories'
import type { UpdateProductCategoryInput } from '@/modules/product-categories'
import { useHasPermission } from '@/lib/use-permissions'

export const Route = createFileRoute(
  '/_dashboard/product-categories/$categoryId',
)({
  component: ProductCategoryDetailPage,
})

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'Baru saja'
  if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`
  if (diffHours < 24) return `${diffHours} jam yang lalu`
  if (diffDays === 1) return 'Kemarin'
  if (diffDays < 7) return `${diffDays} hari yang lalu`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu yang lalu`
  return `${Math.floor(diffDays / 30)} bulan yang lalu`
}

function ProductCategoryDetailPage() {
  const { categoryId } = Route.useParams()
  const router = useRouter()
  const { data: category, isLoading, isError } = useProductCategory(categoryId)

  const updateCategory = useUpdateProductCategory()
  const deleteCategory = useDeleteProductCategory()

  const canUpdate = useHasPermission('productCategory:update')

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  const handleEdit = React.useCallback(() => {
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback(() => {
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!category) return
    await deleteCategory.mutateAsync(category.id)
    setDeleteDialogOpen(false)
    router.navigate({ to: '/product-categories' })
  }, [category, deleteCategory, router])

  const handleSubmit = React.useCallback(
    async (values: {
      name: string
      slug: string
      description: string
      isActive: boolean
      parentId: string | null
    }) => {
      if (!category) return
      const input: UpdateProductCategoryInput & { id: string } = {
        id: category.id,
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        isActive: values.isActive,
        parentId: values.parentId,
      }
      await updateCategory.mutateAsync(input)
      setSheetOpen(false)
    },
    [category, updateCategory],
  )

  if (isLoading) {
    return <ProductCategoryLoadingState />
  }

  if (isError || !category) {
    return <ProductCategoryErrorState />
  }

  const categoryData = category

  return (
    <>
      <main className="flex flex-col gap-8 lg:gap-10 mt-6 mb-20 mx-auto">
        <ProductCategoryDetailHeader
          category={categoryData}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
        />

        <section className="flex flex-col gap-10 lg:pl-14">
          {/* Description */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Deskripsi Kategori
            </h2>
            {categoryData.description ? (
              <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap max-w-3xl">
                {categoryData.description}
              </p>
            ) : (
              <div className="flex flex-col gap-3 py-4">
                <p className="text-muted-foreground text-sm">
                  Belum ada deskripsi untuk kategori ini.
                </p>
                {canUpdate && (
                  <button
                    onClick={handleEdit}
                    className="text-sm text-amber-700 hover:text-amber-800 font-medium self-start transition-colors"
                  >
                    Tambahkan deskripsi →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Children */}
          {categoryData.children.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Sub-Kategori ({categoryData.children.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {categoryData.children.map((child) => (
                  <a
                    key={child.id}
                    href={`/product-categories/${child.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-muted/50 border border-border/30 text-foreground hover:bg-muted transition-colors"
                  >
                    {child.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Produk
            </h2>
            <CategoryProductsTable
              categoryId={categoryData.id}
              hasChildren={categoryData.children.length > 0}
            />
          </div>

          {/* Info Section */}
          <div className="flex flex-col gap-5">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Informasi Kategori
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 max-w-2xl">
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  ID Kategori
                </dt>
                <dd className="text-sm font-mono text-foreground/70">
                  {categoryData.id.slice(0, 8)}...
                  {categoryData.id.slice(-4)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">Slug</dt>
                <dd className="text-sm font-mono text-foreground/70">
                  {categoryData.slug}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  Jumlah Produk
                </dt>
                <dd className="text-sm text-foreground">
                  {categoryData._count.products}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  Urutan Tampilan
                </dt>
                <dd className="text-sm text-foreground">
                  {categoryData.sortOrder}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">Status</dt>
                <dd>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      categoryData.isActive
                        ? 'bg-amber-100/70 text-amber-800 border border-amber-200/50'
                        : 'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        categoryData.isActive ? 'bg-amber-500' : 'bg-stone-400'
                      }`}
                    />
                    {categoryData.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  Kategori Induk
                </dt>
                <dd className="text-sm text-foreground">
                  {categoryData.parent
                    ? categoryData.parent.name
                    : 'Tidak ada (kategori root)'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  Dibuat pada
                </dt>
                <dd className="text-sm text-foreground">
                  {new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(categoryData.createdAt))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  Terakhir diperbarui
                </dt>
                <dd className="text-sm text-foreground">
                  {new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(categoryData.updatedAt))}
                  <span className="text-muted-foreground text-xs ml-2">
                    ({formatRelativeTime(categoryData.updatedAt)})
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      <ProductCategoryFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        category={categoryData}
        onSubmit={handleSubmit}
        isPending={updateCategory.isPending}
        mode="edit"
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus kategori?"
        description={
          <>
            Anda akan menghapus{' '}
            <span className="font-medium text-foreground">
              {categoryData.name}
            </span>
            . Kategori ini akan dipindahkan ke keranjang sampah. Produk dalam
            kategori ini tidak akan terhapus.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteCategory.isPending}
        confirmLabel="Ya, Hapus Kategori"
      />
    </>
  )
}

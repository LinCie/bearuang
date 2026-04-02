import * as React from 'react'
import { Button } from '#components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader as SheetHead,
  SheetTitle,
  SheetDescription,
} from '#components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '#components/ui/dialog'
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
} from '../hooks/use-roles'
import type { Role } from '../hooks/use-roles'
import { RoleFormSheet } from './role-form-sheet'
import { cn } from '#lib/utils'
import { Plus, Pencil, Trash2, Shield, Loader2 } from 'lucide-react'
import { useHasPermission } from '#lib/use-permissions'

// Local form type to avoid strict template literal types from backend
interface RoleFormData {
  role: string
  permissions: string[]
}

// Resource labels for display
const resourceLabels: Record<string, string> = {
  product: 'Produk',
  productVariant: 'Varian Produk',
  warehouse: 'Gudang',
  supplier: 'Pemasok',
  customer: 'Pelanggan',
  purchaseOrder: 'Pesanan Pembelian',
  purchaseOrderItem: 'Item Pesanan Pembelian',
  salesOrder: 'Pesanan Penjualan',
  salesOrderItem: 'Item Pesanan Penjualan',
  stock: 'Stok',
  apiKey: 'Kunci API',
  invitation: 'Undangan',
  member: 'Anggota',
}

interface RoleManagementSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RoleManagementSheet({
  open,
  onOpenChange,
}: RoleManagementSheetProps) {
  const [formSheetOpen, setFormSheetOpen] = React.useState(false)
  const [editingRole, setEditingRole] = React.useState<Role | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingRole, setDeletingRole] = React.useState<Role | null>(null)

  const { data: roles, isLoading } = useRoles()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()
  const canUpdateMembers = useHasPermission('member:update')

  const handleCreateNew = () => {
    setEditingRole(null)
    setFormSheetOpen(true)
  }

  const handleEdit = (role: Role) => {
    setEditingRole(role)
    setFormSheetOpen(true)
  }

  const handleDelete = (role: Role) => {
    setDeletingRole(role)
    setDeleteDialogOpen(true)
  }

  const handleFormSubmit = async (values: RoleFormData) => {
    if (editingRole) {
      await updateRole.mutateAsync({ id: editingRole.id, ...values })
    } else {
      await createRole.mutateAsync(values)
    }
    setFormSheetOpen(false)
    setEditingRole(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingRole) return
    await deleteRole.mutateAsync(deletingRole.id)
    setDeleteDialogOpen(false)
    setDeletingRole(null)
  }

  // Group permissions by resource for display
  const groupPermissionsByResource = (permissions: string[]) => {
    const groups: Record<string, string[]> = {}
    for (const perm of permissions) {
      const [resource, action] = perm.split(':')
      if (resource && action) {
        groups[resource] ??= []
        groups[resource].push(action)
      }
    }
    return groups
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHead className="mb-6">
            <SheetTitle className="text-2xl">Kelola Peran</SheetTitle>
            <SheetDescription className="text-base mt-1 text-balance">
              Buat dan kelola peran kustom dengan izin yang dapat disesuaikan.
            </SheetDescription>
          </SheetHead>

          <div className="px-4 space-y-4">
            {canUpdateMembers && (
              <Button
                onClick={handleCreateNew}
                className="w-full shadow-sm"
                size="lg"
              >
                <Plus className="mr-2 h-5 w-5" />
                Buat Peran Baru
              </Button>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : roles && roles.length > 0 ? (
              <div className="space-y-3">
                {roles.map((role) => {
                  const grouped = groupPermissionsByResource(role.permissions)
                  return (
                    <div
                      key={role.id}
                      className="border border-border/60 rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40">
                            <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">
                              {role.role}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {role.permissions.length} izin
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {canUpdateMembers && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleEdit(role)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(role)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Permission summary */}
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(grouped).map(([resource, actions]) => (
                          <span
                            key={resource}
                            className={cn(
                              'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                              'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
                              'border border-purple-200/50 dark:border-purple-800/30',
                            )}
                          >
                            {resourceLabels[resource] ?? resource}
                            <span className="text-purple-400 dark:text-purple-500">
                              ({actions.length})
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Belum ada peran kustom
                </h3>
                <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                  Buat peran kustom untuk memberikan izin yang spesifik kepada
                  anggota tim Anda.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Create/Edit Form Sheet */}
      <RoleFormSheet
        open={formSheetOpen}
        onOpenChange={setFormSheetOpen}
        onSubmit={handleFormSubmit}
        isPending={createRole.isPending || updateRole.isPending}
        editingRole={editingRole}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Hapus peran?</DialogTitle>
            <DialogDescription className="text-base mt-2">
              Anda akan menghapus peran{' '}
              <span className="font-medium text-foreground">
                {deletingRole?.role}
              </span>
              . Anggota yang menggunakan peran ini akan kehilangan izin yang
              terkait.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteRole.isPending}
            >
              Batalkan
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteRole.isPending}
            >
              {deleteRole.isPending ? 'Menghapus...' : 'Ya, Hapus Peran'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

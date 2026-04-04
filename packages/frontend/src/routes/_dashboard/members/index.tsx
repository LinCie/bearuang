import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { useReactTable, getCoreRowModel } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Users,
  UserPlus,
  MoreHorizontal,
  UserCog,
  Trash2,
  Clock,
  X,
  Mail,
  ShieldCheck,
  Crown,
  Shield,
  Settings2,
} from 'lucide-react'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '#components/ui/dialog'
import { useActiveMember } from '#lib/auth-client'
import { useHasPermission } from '#lib/use-permissions'
import { cn } from '#lib/utils'
import { useDebounce } from '#hooks/use-debounce'
import {
  useMembers,
  useInvitations,
  useCreateInvitation,
  useCancelInvitation,
  useUpdateMemberRole,
  useRemoveMember,
  InviteMemberSheet,
} from '#modules/members/index'
import type { Member, Invitation } from '#modules/members/index'
import { RoleManagementSheet, useRoles } from '#modules/roles/index'
import type { Role } from '#modules/roles/index'

export const Route = createFileRoute('/_dashboard/members/')({
  component: MembersPage,
})

// ─── Helpers ──────────────────────────────────────────────────

const roleConfig = {
  owner: {
    label: 'Pemilik',
    icon: Crown,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40',
  },
  admin: {
    label: 'Admin',
    icon: ShieldCheck,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40',
  },
  member: {
    label: 'Anggota',
    icon: Users,
    color: 'text-muted-foreground',
    bg: 'bg-muted/50 border-border',
  },
  custom: {
    label: 'Kustom',
    icon: Shield,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/40',
  },
} as const

function getRoleConfig(role: string, customRoles?: Role[]) {
  if (role in roleConfig) {
    return roleConfig[role as keyof typeof roleConfig]
  }
  // Check if it's a custom role
  const customRole = customRoles?.find((r) => r.role === role)
  if (customRole) {
    return {
      ...roleConfig.custom,
      label: customRole.role,
    }
  }
  // Default fallback for unknown custom roles
  return {
    ...roleConfig.custom,
    label: role,
  }
}

// ─── Component ────────────────────────────────────────────────

function MembersPage() {
  const [search, setSearch] = React.useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [inviteSheetOpen, setInviteSheetOpen] = React.useState(false)

  // Role management sheet
  const [roleManagementOpen, setRoleManagementOpen] = React.useState(false)

  // Remove member dialog
  const [removeDialogOpen, setRemoveDialogOpen] = React.useState(false)
  const [removingMember, setRemovingMember] = React.useState<Member | null>(
    null,
  )

  // Change role dialog
  const [roleDialogOpen, setRoleDialogOpen] = React.useState(false)
  const [changingMember, setChangingMember] = React.useState<Member | null>(
    null,
  )
  const [newRole, setNewRole] = React.useState<string>('')

  // Cancel invitation dialog
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [cancelingInvitation, setCancelingInvitation] =
    React.useState<Invitation | null>(null)

  // Active member (for self-check in actions column)
  const { data: activeMember } = useActiveMember()

  const canInvite = useHasPermission('invitation:create')
  const canManageMembers = useHasPermission('member:update')

  // Fetch custom roles for display and role change dialog
  const { data: customRoles } = useRoles()

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  // ─── Data ─────────────────────────────────────────────────

  const { data: membersData, isLoading: membersLoading } = useMembers({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    search: debouncedSearch || undefined,
  })

  const { data: invitationsData } = useInvitations({
    page: 1,
    pageSize: 50,
    status: 'pending',
  })

  const createInvitation = useCreateInvitation()
  const cancelInvitation = useCancelInvitation()
  const updateMemberRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()

  const members = membersData?.data ?? []
  const membersMeta = membersData?.meta
  const invitations = invitationsData?.data ?? []

  // ─── Handlers ─────────────────────────────────────────────

  const handleInvite = React.useCallback(
    async (values: { email: string; role: string }) => {
      await createInvitation.mutateAsync(values)
      setInviteSheetOpen(false)
    },
    [createInvitation],
  )

  const handleRemoveConfirm = React.useCallback(async () => {
    if (!removingMember) return
    await removeMember.mutateAsync(removingMember.id)
    setRemoveDialogOpen(false)
    setRemovingMember(null)
  }, [removingMember, removeMember])

  const handleRoleChangeConfirm = React.useCallback(async () => {
    if (!changingMember || !newRole) return
    await updateMemberRole.mutateAsync({ id: changingMember.id, role: newRole })
    setRoleDialogOpen(false)
    setChangingMember(null)
    setNewRole('')
  }, [changingMember, newRole, updateMemberRole])

  const handleCancelInvitationConfirm = React.useCallback(async () => {
    if (!cancelingInvitation) return
    await cancelInvitation.mutateAsync(cancelingInvitation.id)
    setCancelDialogOpen(false)
    setCancelingInvitation(null)
  }, [cancelingInvitation, cancelInvitation])

  // ─── Table Columns ─────────────────────────────────────────

  const columns = React.useMemo<ColumnDef<Member>[]>(
    () => [
      {
        accessorKey: 'user',
        header: 'Anggota',
        cell: ({ row }) => {
          const user = row.original.user
          return (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-foreground truncate">
                  {user.name}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {user.email}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'role',
        header: 'Peran',
        cell: ({ row }) => {
          const config = getRoleConfig(row.original.role, customRoles)
          const Icon = config.icon
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
                config.bg,
                config.color,
              )}
            >
              <Icon className="w-3 h-3" />
              {config.label}
            </span>
          )
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Bergabung',
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt)
          return (
            <span className="text-muted-foreground text-sm">
              {date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => {
          if (!canManageMembers) return null
          const member = row.original
          const isOwner = member.role === 'owner'
          const isSelf = activeMember?.id === member.id

          if (isSelf) return null

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Menu aksi</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => {
                      setChangingMember(member)
                      setNewRole(member.role)
                      setRoleDialogOpen(true)
                    }}
                    disabled={isOwner}
                  >
                    <UserCog className="w-4 h-4 mr-2" />
                    Ubah Peran
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setRemovingMember(member)
                      setRemoveDialogOpen(true)
                    }}
                    disabled={isOwner}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Hapus dari Organisasi
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [canManageMembers, activeMember?.id, customRoles],
  )

  const table = useReactTable({
    data: members,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  // ─── Render ────────────────────────────────────────────────

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-semibold text-foreground tracking-tight">
            Anggota Organisasi
          </h2>
          <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
            Kelola anggota tim dan undang rekan untuk bergabung.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canManageMembers && (
            <Button
              onClick={() => setRoleManagementOpen(true)}
              variant="outline"
              size="lg"
              className="shadow-sm hover:shadow-md transition-all active:scale-95 sm:w-auto w-full"
            >
              <Settings2 className="mr-2 h-5 w-5" />
              Kelola Peran
            </Button>
          )}
          {canInvite && (
            <Button
              onClick={() => setInviteSheetOpen(true)}
              size="lg"
              className="shadow-sm hover:shadow-md transition-all active:scale-95 sm:w-auto w-full"
            >
              <UserPlus className="mr-2 h-5 w-5" />
              Undang Anggota
            </Button>
          )}
        </div>
      </div>

      {/* Members Table */}
      <DataTable
        table={table}
        isLoading={membersLoading}
        loadingState={{
          icon: Users,
          title: 'Memuat daftar anggota',
          description:
            'Sebentar ya, kami sedang mengambil daftar anggota tim Anda.',
        }}
        searchEmptyState={{
          onClear: () => setSearch(''),
          title: 'Tidak ada anggota yang cocok',
        }}
        emptyState={{
          icon: Users,
          title: 'Belum ada anggota',
          description:
            'Undang anggota tim untuk mulai berkolaborasi mengelola bisnis Anda.',
          ...(canInvite && {
            action: {
              label: 'Undang Anggota Pertama',
              onClick: () => setInviteSheetOpen(true),
              icon: UserPlus,
            },
          }),
        }}
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Cari anggota berdasarkan nama atau email..."
        searchAriaLabel="Cari anggota"
        pagination={pagination}
        onPaginationChange={setPagination}
        meta={
          membersMeta
            ? {
                total: membersMeta.total,
                totalPages: membersMeta.totalPages,
                hasPrev: membersMeta.hasPrev,
                hasNext: membersMeta.hasNext,
              }
            : undefined
        }
        itemLabel="anggota"
      />

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">
              Undangan Tertunda
            </h3>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {invitations.length}
            </span>
          </div>
          <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
            <Table className="w-full min-w-[400px]">
              <TableHeader>
                <TableRow className="border-b border-border/40 bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50/30 dark:hover:bg-amber-950/10">
                  <TableHead>Email</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead>Dikirim</TableHead>
                  <TableHead>
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => {
                  const config = getRoleConfig(
                    invitation.role ?? 'member',
                    customRoles,
                  )
                  const Icon = config.icon
                  const date = new Date(invitation.createdAt)
                  return (
                    <TableRow
                      key={invitation.id}
                      className="border-b border-border/40 hover:bg-amber-50/20 dark:hover:bg-amber-900/10 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm">{invitation.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
                            config.bg,
                            config.color,
                          )}
                        >
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">
                          {date.toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        {canInvite && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={() => {
                              setCancelingInvitation(invitation)
                              setCancelDialogOpen(true)
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Batalkan
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Invite Sheet */}
      <InviteMemberSheet
        open={inviteSheetOpen}
        onOpenChange={setInviteSheetOpen}
        onSubmit={handleInvite}
        isPending={createInvitation.isPending}
      />

      {/* Role Management Sheet */}
      <RoleManagementSheet
        open={roleManagementOpen}
        onOpenChange={setRoleManagementOpen}
      />

      {/* Remove Member Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Hapus dari organisasi?
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Anda akan menghapus{' '}
              <span className="font-medium text-foreground">
                {removingMember?.user.name}
              </span>{' '}
              dari organisasi ini. Anggota ini akan kehilangan akses ke semua
              data organisasi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRemoveDialogOpen(false)}
              disabled={removeMember.isPending}
            >
              Batalkan
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveConfirm}
              disabled={removeMember.isPending}
            >
              {removeMember.isPending ? 'Menghapus...' : 'Ya, Hapus Anggota'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Ubah Peran Anggota</DialogTitle>
            <DialogDescription className="text-base mt-2">
              Ubah peran{' '}
              <span className="font-medium text-foreground">
                {changingMember?.user.name}
              </span>{' '}
              dalam organisasi ini.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2 max-h-[50vh] overflow-y-auto">
            {/* System roles */}
            {(['member', 'admin', 'owner'] as const).map((role) => {
              const config = getRoleConfig(role, customRoles)
              const Icon = config.icon
              const isSelected = newRole === role
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setNewRole(role)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-border hover:bg-muted/50',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      isSelected ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <div>
                    <p
                      className={cn(
                        'text-sm font-medium',
                        isSelected ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {config.label}
                    </p>
                  </div>
                </button>
              )
            })}

            {/* Custom roles */}
            {customRoles && customRoles.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-1 py-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground font-medium">
                    Peran Kustom
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {customRoles.map((role) => {
                  const config = getRoleConfig(role.role, customRoles)
                  const Icon = config.icon
                  const isSelected = newRole === role.role
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setNewRole(role.role)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all',
                        isSelected
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500/20'
                          : 'border-border hover:border-border hover:bg-muted/50',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-5 w-5 shrink-0',
                          isSelected
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-muted-foreground',
                        )}
                      />
                      <div>
                        <p
                          className={cn(
                            'text-sm font-medium',
                            isSelected
                              ? 'text-purple-700 dark:text-purple-300'
                              : 'text-foreground',
                          )}
                        >
                          {role.role}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {role.permissions.length} izin
                        </p>
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              disabled={updateMemberRole.isPending}
            >
              Batalkan
            </Button>
            <Button
              onClick={handleRoleChangeConfirm}
              disabled={
                updateMemberRole.isPending ||
                !newRole ||
                newRole === changingMember?.role
              }
            >
              {updateMemberRole.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Invitation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Batalkan undangan?</DialogTitle>
            <DialogDescription className="text-base mt-2">
              Undangan untuk{' '}
              <span className="font-medium text-foreground">
                {cancelingInvitation?.email}
              </span>{' '}
              akan dibatalkan. Anda dapat mengirim undangan baru kapan saja.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelInvitation.isPending}
            >
              Kembali
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelInvitationConfirm}
              disabled={cancelInvitation.isPending}
            >
              {cancelInvitation.isPending
                ? 'Membatalkan...'
                : 'Ya, Batalkan Undangan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

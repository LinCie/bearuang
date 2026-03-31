import * as React from 'react'
import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import {
  Home,
  Package,
  Warehouse,
  Settings,
  Search,
  PawPrint,
  LogOut,
  ArrowLeftRight,
  Truck,
  Users,
  ClipboardList,
  ShoppingCart,
  Monitor,
  UserPlus,
  KeyRound,
  ScrollText,
  Tag,
} from 'lucide-react'
import { signOut, useSession } from '@/lib/auth-client'
import { usePermissions } from '@/lib/use-permissions'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
} from '@/components/ui/sidebar'

interface NavItem {
  icon: React.ElementType
  label: string
  to: string
  permission?: string
}

const MAIN_NAV: NavItem[] = [
  { icon: Home, label: 'Home', to: '/' },
  {
    icon: Monitor,
    label: 'POS',
    to: '/pos',
    permission: 'salesOrder',
  },
  { icon: Package, label: 'Produk', to: '/products', permission: 'product' },
  {
    icon: Tag,
    label: 'Kategori Produk',
    to: '/product-categories',
    permission: 'productCategory',
  },
  {
    icon: Warehouse,
    label: 'Gudang',
    to: '/warehouses',
    permission: 'warehouse',
  },
  {
    icon: ArrowLeftRight,
    label: 'Pergerakan Stok',
    to: '/stock-movements',
    permission: 'stock',
  },
  { icon: Truck, label: 'Pemasok', to: '/suppliers', permission: 'supplier' },
  {
    icon: ClipboardList,
    label: 'Pesanan Pembelian',
    to: '/purchase-orders',
    permission: 'purchaseOrder',
  },
  { icon: Users, label: 'Pelanggan', to: '/customers', permission: 'customer' },
  {
    icon: ShoppingCart,
    label: 'Pesanan Penjualan',
    to: '/sales-orders',
    permission: 'salesOrder',
  },
]

const SECONDARY_NAV: NavItem[] = [
  { icon: UserPlus, label: 'Anggota', to: '/members', permission: 'member' },
  { icon: KeyRound, label: 'API Keys', to: '/api-keys', permission: 'apiKey' },
  {
    icon: ScrollText,
    label: 'Log Audit',
    to: '/audit-logs',
    permission: 'auditLog',
  },
  { icon: Settings, label: 'Settings', to: '/settings' },
]

function useTimeGreeting(): string {
  const [greeting, setGreeting] = React.useState(() => getGreeting())

  React.useEffect(() => {
    // Update greeting every 10 minutes
    const interval = setInterval(() => setGreeting(getGreeting()), 600_000)
    return () => clearInterval(interval)
  }, [])

  return greeting
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Selamat Pagi'
  if (hour < 17) return 'Selamat Siang'
  if (hour < 20) return 'Selamat Sore'
  return 'Selamat Malam'
}

function NavItemLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.label}
        className={cn(
          'py-5 px-4 rounded-lg transition-[colors,transform] duration-200 group/nav relative',
          isActive
            ? 'text-sidebar-primary font-semibold bg-sidebar-accent'
            : 'text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:translate-x-0.5 font-medium',
        )}
      >
        <Link to={item.to} className="flex items-center gap-3 w-full">
          {/* Warm left accent for active item */}
          {isActive && (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full"
              aria-hidden="true"
            />
          )}
          <Icon
            className={cn(
              'w-5 h-5 shrink-0 transition-transform duration-200',
              isActive ? 'stroke-[2.5]' : 'group-hover/nav:scale-110',
            )}
          />
          <span className="text-sm">{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: sessionData } = useSession()
  const userName = sessionData?.user.name || 'User'
  const userEmail = sessionData?.user.email || ''
  const firstName = userName.split(' ')[0]
  const router = useRouter()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const greeting = useTimeGreeting()
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const { data: permissions } = usePermissions()

  const filteredMainNav = MAIN_NAV.filter(
    (item): item is NavItem =>
      !item.permission || !!permissions?.viewResources.has(item.permission),
  )
  const filteredSecondaryNav = SECONDARY_NAV.filter(
    (item): item is NavItem =>
      !item.permission || !!permissions?.viewResources.has(item.permission),
  )

  async function handleSignOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      await signOut()
      router.navigate({ to: '/signin' })
    } catch {
      setIsSigningOut(false)
    }
  }

  return (
    <SidebarProvider>
      <Sidebar className="border-r border-sidebar-border/10">
        {/* Brand Header — warm and grounded */}
        <SidebarHeader className="py-6 px-4">
          <div className="px-2 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <PawPrint className="w-5 h-5" />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight leading-tight">
                BearUang
              </h1>
              <p className="text-[11px] text-sidebar-foreground/50 leading-tight">
                {greeting}, {firstName}
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2">
          {/* Main Navigation Group */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase tracking-widest text-[10px] font-semibold px-4 mb-1">
              Menu
            </SidebarGroupLabel>
            <nav aria-label="Main navigation">
              <SidebarMenu>
                {filteredMainNav.map((item) => (
                  <NavItemLink
                    key={item.label}
                    item={item}
                    isActive={
                      item.to === '/'
                        ? currentPath === '/'
                        : currentPath === item.to ||
                          currentPath.startsWith(item.to + '/')
                    }
                  />
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroup>

          <SidebarSeparator className="opacity-30 mx-4" />

          {/* Secondary Navigation Group */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase tracking-widest text-[10px] font-semibold px-4 mb-1">
              Lainnya
            </SidebarGroupLabel>
            <nav aria-label="Secondary navigation">
              <SidebarMenu>
                {filteredSecondaryNav.map((item) => (
                  <NavItemLink
                    key={item.label}
                    item={item}
                    isActive={
                      item.to === '/'
                        ? currentPath === '/'
                        : currentPath === item.to ||
                          currentPath.startsWith(item.to + '/')
                    }
                  />
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroup>
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-background min-h-screen relative flex-1 flex flex-col w-full">
        {/* TopAppBar — distilled to essentials: trigger, search, profile */}
        <header className="sticky top-0 right-0 left-0 h-14 z-40 bg-background flex items-center justify-between px-4 md:px-8 shrink-0 border-b border-border/10">
          <div className="flex items-center gap-2 lg:gap-4">
            <SidebarTrigger className="text-muted-foreground hover:bg-muted p-2 rounded-lg transition-colors -ml-2" />
            <search className="hidden md:flex items-center bg-muted px-4 py-2 rounded-lg w-64 lg:w-80 group focus-within:ring-2 focus-within:ring-primary/20 transition-shadow duration-200">
              <Search
                className="w-4 h-4 text-muted-foreground mr-3 shrink-0"
                aria-hidden="true"
              />
              <input
                className="bg-transparent border-none focus:ring-0 outline-none text-sm w-full placeholder:text-muted-foreground/50"
                placeholder="Cari entri..."
                aria-label="Cari entri"
                name="search"
                type="text"
              />
            </search>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Menu akun untuk ${userName}`}
                className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-sm hover:bg-primary/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
              >
                {userName.charAt(0).toUpperCase()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-foreground truncate">
                    {userName}
                  </p>
                  {userEmail && (
                    <p className="text-xs text-muted-foreground truncate">
                      {userEmail}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <Settings className="w-4 h-4" aria-hidden="true" />
                  Pengaturan
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="cursor-pointer"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                {isSigningOut ? 'Keluar...' : 'Keluar'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Main Content Area */}
        <div className="px-4 md:px-10 py-8 flex-1 w-full max-w-full overflow-x-hidden">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

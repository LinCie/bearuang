import * as React from 'react'
import { useWarehouses } from '@/modules/warehouses/hooks/use-warehouses'
import { useCustomers } from '@/modules/customers/hooks/use-customers'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CreditCard, Settings2, Store, Trash2, User } from 'lucide-react'
import type { CartItem } from '../hooks/use-pos-cart'

interface PosCheckoutPanelProps {
  items: CartItem[]
  subtotal: number
  onCheckout: (data: {
    warehouseId: string
    customerId?: string
    guestName: string
  }) => void
  onClearCart?: () => void
  isProcessing: boolean
}

export function PosCheckoutPanel({
  items,
  subtotal,
  onCheckout,
  onClearCart,
  isProcessing,
}: PosCheckoutPanelProps) {
  const [warehouseId, setWarehouseId] = React.useState<string>('')
  const [customerId, setCustomerId] = React.useState<string>('__none__')
  const [guestName, setGuestName] = React.useState('')
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const { data: warehousesData } = useWarehouses({ pageSize: 100 })
  const { data: customersData } = useCustomers({ pageSize: 100 })

  const warehouses = warehousesData?.data ?? []
  const customers = customersData?.data ?? []

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId)
  const selectedCustomer = customers.find((c) => c.id === customerId)

  React.useEffect(() => {
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id)
    }
  }, [warehouses, warehouseId])

  function handleCheckout() {
    if (!warehouseId) return
    const selectedCustomerId =
      customerId !== '__none__' ? customerId : undefined
    onCheckout({
      warehouseId,
      customerId: selectedCustomerId,
      guestName: selectedCustomerId ? '' : guestName || 'Tamu',
    })
  }

  const canCheckout = items.length > 0 && !!warehouseId

  return (
    <div className="border-l-2 border-primary/20 lg:border-l-2 border-t-2 lg:border-t-0 border-primary/20">
      <div className="p-3">
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <div className="flex items-center justify-between gap-2">
            {/* Compact Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Store className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {selectedWarehouse?.name || 'Pilih gudang...'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {selectedCustomer?.name || guestName || 'Tamu'}
                </span>
              </div>
            </div>

            {/* Clear Cart Button - Icon Only */}
            {items.length > 0 && onClearCart && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onClearCart}
                aria-label="Kosongkan keranjang"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}

            {/* Settings Button - Icon Only */}
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
              >
                <Settings2 className="w-4 h-4" />
              </Button>
            </DialogTrigger>
          </div>

          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Pengaturan Transaksi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Gudang</label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih gudang" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Pelanggan
                </label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih pelanggan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tamu</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {customerId === '__none__' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Nama Tamu
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Tamu"
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-t border-border/50 p-3 pt-2 space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-2xl font-extrabold tabular-nums">
            Rp {subtotal.toLocaleString('id-ID')}
          </span>
        </div>

        <Button
          className="w-full h-12 text-base font-bold gap-2 shadow-md active:translate-y-0.5 active:shadow-sm transition-all"
          size="lg"
          disabled={!canCheckout || isProcessing}
          onClick={handleCheckout}
        >
          <CreditCard className="w-4 h-4" />
          {isProcessing ? 'Memproses...' : 'Bayar'}
        </Button>
      </div>
    </div>
  )
}

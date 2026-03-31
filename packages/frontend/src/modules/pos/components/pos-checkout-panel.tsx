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
import { CreditCard, Settings2, ChevronDown } from 'lucide-react'
import type { CartItem } from '../hooks/use-pos-cart'

interface PosCheckoutPanelProps {
  items: CartItem[]
  subtotal: number
  itemCount: number
  onCheckout: (data: {
    warehouseId: string
    customerId?: string
    guestName: string
  }) => void
  isProcessing: boolean
}

export function PosCheckoutPanel({
  items,
  subtotal,
  itemCount,
  onCheckout,
  isProcessing,
}: PosCheckoutPanelProps) {
  const [warehouseId, setWarehouseId] = React.useState<string>('')
  const [customerId, setCustomerId] = React.useState<string>('__none__')
  const [guestName, setGuestName] = React.useState('')
  const [showSettings, setShowSettings] = React.useState(false)

  const { data: warehousesData } = useWarehouses({ pageSize: 100 })
  const { data: customersData } = useCustomers({ pageSize: 100 })

  const warehouses = warehousesData?.data ?? []
  const customers = customersData?.data ?? []

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
    <div className="flex flex-col h-full border-l-2 border-primary/20 lg:border-l-2 border-t-2 lg:border-t-0 border-primary/20">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Pengaturan</span>
          <ChevronDown
            className={`w-3.5 h-3.5 ml-auto transition-transform ${showSettings ? 'rotate-180' : ''}`}
          />
        </button>

        {showSettings && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Gudang
              </label>
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
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
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
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Nama Tamu
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Tamu"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            )}
          </div>
        )}

        <div className="border-t border-border/50 pt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{itemCount} item</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/50 p-4 space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-medium">Total</span>
          <span className="text-3xl font-extrabold tabular-nums">
            Rp {subtotal.toLocaleString('id-ID')}
          </span>
        </div>

        <Button
          className="w-full h-14 text-lg font-bold gap-2 shadow-md active:translate-y-0.5 active:shadow-sm transition-all"
          size="lg"
          disabled={!canCheckout || isProcessing}
          onClick={handleCheckout}
        >
          <CreditCard className="w-5 h-5" />
          {isProcessing ? 'Memproses...' : 'Bayar'}
        </Button>
      </div>
    </div>
  )
}

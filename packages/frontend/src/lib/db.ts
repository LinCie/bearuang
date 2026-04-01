import Dexie from 'dexie'

interface SyncMetaItem {
  key: string
  value: string
}

interface ProductRecord {
  id: string
  organizationId: string
  name: string
  slug: string
  description: string | null
  categoryId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

interface VariantRecord {
  id: string
  organizationId: string
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
  deletedAt: string | null
}

interface ProductCategoryRecord {
  id: string
  organizationId: string
  parentId: string | null
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

interface CustomerRecord {
  id: string
  organizationId: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface WarehouseRecord {
  id: string
  organizationId: string
  name: string
  address: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface SupplierRecord {
  id: string
  organizationId: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface MutationQueueItem {
  id?: number
  createdAt: string
  status: string
  model: string
  operation: string
  data: Record<string, unknown>
}

interface SalesOrderRecord {
  id: string
  organizationId: string
  status: string
  createdAt: string
  updatedAt: string
}

interface StockSnapshotRecord {
  variantId: string
  warehouseId: string
  stock: number
  updatedAt: string
}

class BearUangDB extends Dexie {
  syncMeta!: Dexie.Table<SyncMetaItem, string>
  products!: Dexie.Table<ProductRecord, string>
  variants!: Dexie.Table<VariantRecord, string>
  productCategories!: Dexie.Table<ProductCategoryRecord, string>
  customers!: Dexie.Table<CustomerRecord, string>
  warehouses!: Dexie.Table<WarehouseRecord, string>
  suppliers!: Dexie.Table<SupplierRecord, string>
  mutationQueue!: Dexie.Table<MutationQueueItem, number>
  salesOrders!: Dexie.Table<SalesOrderRecord, string>
  stockSnapshot!: Dexie.Table<StockSnapshotRecord, string>

  constructor() {
    super('bearuang-offline')

    this.version(1).stores({
      syncMeta: 'key,value',
      products: 'id,organizationId,name,slug,categoryId,updatedAt',
      variants: 'id,organizationId,productId,sku,name,stock,updatedAt',
      productCategories: 'id,organizationId,parentId,slug,updatedAt',
      customers: 'id,organizationId,name,email,updatedAt',
      warehouses: 'id,organizationId,name,updatedAt',
      suppliers: 'id,organizationId,name,updatedAt',
      mutationQueue: '++id,createdAt,status,model,operation',
      salesOrders: 'id,organizationId,status,createdAt,updatedAt',
      stockSnapshot: 'variantId,warehouseId,stock,updatedAt',
    })
  }
}

export const db = new BearUangDB()

const SYNCABLE_TABLES = [
  'products',
  'variants',
  'productCategories',
  'customers',
  'warehouses',
  'suppliers',
] as const

type SyncableTable = (typeof SYNCABLE_TABLES)[number]

export { type SyncableTable, SYNCABLE_TABLES }

export async function clearOrgData(organizationId: string): Promise<void> {
  await Promise.all(
    SYNCABLE_TABLES.map((table) =>
      db[table].where('organizationId').equals(organizationId).delete(),
    ),
  )
  await Promise.all(
    SYNCABLE_TABLES.map((table) =>
      db.syncMeta.where('key').equals(`lastSync:${table}`).delete(),
    ),
  )
}

export async function getLastSync(model: string): Promise<string | null> {
  const entry = await db.syncMeta.get(`lastSync:${model}`)
  return entry?.value ?? null
}

export async function setLastSync(
  model: string,
  timestamp: string,
): Promise<void> {
  await db.syncMeta.put({ key: `lastSync:${model}`, value: timestamp })
}

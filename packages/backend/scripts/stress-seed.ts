#!/usr/bin/env bun

import { fakerID_ID as faker } from '@faker-js/faker'

const args = process.argv.slice(2)

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')
    ? args[idx + 1]
    : undefined
}

const API_KEY = getArg('api-key') || process.env.STRESS_API_KEY || ''
const SCALE = Number(getArg('scale') || '1')
const BASE_URL = getArg('base-url') || 'http://localhost:8000'

if (!API_KEY) {
  console.error(
    'Usage: bun run scripts/stress-seed.ts --api-key <key> [--scale <n>] [--base-url <url>]',
  )
  console.error('       STRESS_API_KEY=<key> bun run scripts/stress-seed.ts')
  process.exit(1)
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface ApiResponse<T = unknown> {
  status: number
  data: T | null
  error: unknown
}

async function apiCall<T = unknown>(
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`
  const init: RequestInit = {
    method,
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
  }
  if (body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(body)
  }
  const res = await fetch(url, init)
  const text = await res.text()
  let data: T | null = null
  let error: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as T
    } catch {
      error = text
    }
  }
  if (!res.ok) {
    error = data ?? text
    data = null
  }
  return { status: res.status, data, error }
}

async function putFile(
  uploadUrl: string,
  file: Blob,
  contentType: string,
): Promise<boolean> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': contentType },
  })
  return res.ok
}

interface HasId {
  id: string
}

interface POData extends HasId {
  status: string
  items: Array<{ id: string; variantId: string; quantity: number }>
}

interface SOData extends HasId {
  status: string
}

interface BatchResult {
  ok: number
  fail: number
  errors: string[]
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min: number, max: number, decimals = 2): number {
  return Number((Math.random() * (max - min) + min).toFixed(decimals))
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (e: unknown) {
      if (i < retries) {
        await sleep(Math.min(1000 * 2 ** i, 8000))
        continue
      }
      throw e
    }
  }
  throw new Error('unreachable')
}

async function runBatch<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<unknown>,
): Promise<BatchResult> {
  const result: BatchResult = { ok: 0, fail: 0, errors: [] }
  const total = Math.ceil(items.length / concurrency)

  for (let b = 0; b < total; b++) {
    const chunk = items.slice(b * concurrency, (b + 1) * concurrency)
    const settled = await Promise.allSettled(
      chunk.map((item) => withRetry(() => fn(item))),
    )
    for (const s of settled) {
      if (s.status === 'fulfilled') result.ok++
      else {
        result.fail++
        const msg =
          s.reason instanceof Error ? s.reason.message : String(s.reason)
        if (result.errors.length < 20) result.errors.push(msg)
      }
    }
    if ((b + 1) % 5 === 0 || b === total - 1) {
      process.stdout.write(
        `    [${b + 1}/${total}] ${result.ok} ok, ${result.fail} fail\r`,
      )
    }
  }
  console.log()
  return result
}

const PRODUCT_PREFIXES = [
  'Premium',
  'Organic',
  'Fresh',
  'Natural',
  'Classic',
  'Royal',
  'Golden',
  'Super',
  'Deluxe',
  'Select',
  'Finest',
  'Pure',
  'Authentic',
  'Traditional',
  'Special',
  'Homemade',
  'Import',
  'Local',
  'Handmade',
  'Artisan',
] as const

const PRODUCT_BASES = [
  'Beras',
  'Gula',
  'Minyak',
  'Tepung',
  'Kopi',
  'Teh',
  'Susu',
  'Mie',
  'Kecap',
  'Sambal',
  'Bawang',
  'Cabai',
  'Tomat',
  'Kentang',
  'Wortel',
  'Bayam',
  'Kangkung',
  'Tempe',
  'Tahu',
  'Telur',
  'Ayam',
  'Daging',
  'Ikan',
  'Udang',
  'Cumi',
  'Kerupuk',
  'Rendang',
  'Sate',
  'Bakso',
  'Gado-gado',
  'Nasi',
  'Roti',
  'Kue',
  'Biskuit',
  'Cokelat',
  'Madu',
  'Jahe',
  'Kunyit',
  'Lengkuas',
  'Serai',
  'Kayu Manis',
  'Cengkeh',
  'Pala',
  'Merica',
  'Garam',
  'Santan',
  'Kelapa',
  'Mentega',
  'Keju',
  'Yogurt',
  'Jus',
  'Sirup',
  'Selai',
  'Oat',
  'Sereal',
  'Kacang',
  'Kurma',
  'Minuman',
  'Snack',
  'Bumbu',
  'Rempah',
  'Saus',
  'Terasi',
] as const

const UNITS = [
  'pcs',
  'kg',
  'gram',
  'liter',
  'ml',
  'pack',
  'box',
  'lusin',
  'rim',
  'karung',
  'botol',
  'kaleng',
  'bungkus',
  'ikat',
  'butir',
] as const

const ATTRIBUTE_OPTIONS = [
  { key: 'berat', values: ['100g', '250g', '500g', '1kg', '2kg', '5kg'] },
  {
    key: 'warna',
    values: ['Merah', 'Biru', 'Hijau', 'Kuning', 'Hitam', 'Putih'],
  },
  { key: 'ukuran', values: ['S', 'M', 'L', 'XL', 'XXL'] },
  { key: 'rasa', values: ['Original', 'Pedas', 'Manis', 'Asin', 'Sour'] },
  {
    key: 'kemasan',
    values: ['Plastik', 'Kaleng', 'Kardus', 'Botol', 'Vacuum'],
  },
  { key: 'expired', values: ['3 bulan', '6 bulan', '12 bulan', '24 bulan'] },
  { key: 'grade', values: ['A', 'B', 'C', 'Premium', 'Ekonomi'] },
  { key: 'asal', values: ['Lokal', 'Import', 'Organik', 'Tradisional'] },
] as const

function generateProductName(): { name: string; slug: string } {
  const prefix = Math.random() > 0.4 ? `${pick(PRODUCT_PREFIXES)} ` : ''
  const base = pick(PRODUCT_BASES)
  const suffix = Math.random() > 0.8 ? ` ${randInt(100, 999)}` : ''
  const name = `${prefix}${base}${suffix}`.trim()
  const slug =
    `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${faker.string.alphanumeric(4)}`.replace(
      /-+/g,
      '-',
    )
  return { name, slug }
}

function generateVariantAttributes(): Record<string, string> {
  const attrs: Record<string, string> = {}
  const count = randInt(0, 2)
  const shuffled = [...ATTRIBUTE_OPTIONS].sort(() => Math.random() - 0.5)
  for (let i = 0; i < count; i++) {
    attrs[shuffled[i].key] = pick(shuffled[i].values)
  }
  return attrs
}

const CATEGORY_DATA = [
  { name: 'Makanan Pokok', slug: 'makanan-pokok' },
  { name: 'Bumbu Dapur', slug: 'bumbu-dapur' },
  { name: 'Minuman', slug: 'minuman' },
  { name: 'Snack & Camilan', slug: 'snack-camilan' },
  { name: 'Bahan Kue', slug: 'bahan-kue' },
  { name: 'Olahan Susu', slug: 'olahan-susu' },
  { name: 'Daging & Seafood', slug: 'daging-seafood' },
  { name: 'Sayuran Segar', slug: 'sayuran-segar' },
  { name: 'Buah-buahan', slug: 'buah-buahan' },
  { name: 'Rempah & Bumbu', slug: 'rempah-bumbu' },
  { name: 'Mie & Pasta', slug: 'mie-pasta' },
  { name: 'Minyak & Lemak', slug: 'minyak-lemak' },
  { name: 'Tepung & Biji-bijian', slug: 'tepun-biji-bijian' },
  { name: 'Produk Kesehatan', slug: 'produk-kesehatan' },
] as const

const WAREHOUSE_CITIES = [
  { name: 'Gudang Jakarta', address: 'Jl. Tanjung Priok No. 1, Jakarta Utara' },
  { name: 'Gudang Surabaya', address: 'Jl. Perak Barat No. 88, Surabaya' },
  { name: 'Gudang Bandung', address: 'Jl. Soekarno-Hatta No. 456, Bandung' },
  { name: 'Gudang Semarang', address: 'Jl. Semarang Indah No. 12, Semarang' },
  { name: 'Gudang Medan', address: 'Jl. Gatot Subroto No. 78, Medan' },
] as const

async function main() {
  console.log('\n🧪 BearUang Stress Seed')
  console.log(`   URL: ${BASE_URL} | Scale: ${SCALE}x\n`)

  const t0 = Date.now()
  let totalOk = 0
  let totalFail = 0
  const allErrors: string[] = []

  function track(r: BatchResult) {
    totalOk += r.ok
    totalFail += r.fail
    allErrors.push(...r.errors)
  }

  function step(n: number, label: string) {
    console.log(`Step ${n}: ${label}`)
  }

  step(0, 'Health check')
  try {
    const { status } = await apiCall('GET', '/health')
    if (status !== 200) throw new Error(`status ${status}`)
    console.log('  ✓ Backend reachable\n')
  } catch (e: unknown) {
    console.error(`  ✗ Backend not reachable: ${e}`)
    process.exit(1)
  }

  step(1, 'Idempotency check')
  try {
    const { data, status } = await apiCall<{ data: unknown[] }>(
      'GET',
      '/product-categories/?search=__stress-seed__&pageSize=1',
    )
    if (status === 200 && data?.data && data.data.length > 0) {
      console.error(
        '  ✗ Seed data exists (found __stress-seed__ category). Delete it first.',
      )
      process.exit(1)
    }
    console.log('  ✓ Clean slate\n')
  } catch (e: unknown) {
    console.error(`  ✗ Check failed: ${e}`)
    process.exit(1)
  }

  const CAT_COUNT = Math.max(1, Math.floor(15 * SCALE))
  step(2, `Creating ${CAT_COUNT} categories`)
  const categoryIds: string[] = []
  {
    const { data: markerCat } = await apiCall<HasId>(
      'POST',
      '/product-categories/',
      {
        name: '__stress-seed__',
        slug: '__stress-seed__',
        description: 'Stress seed marker — safe to delete',
      },
    )
    if (markerCat) categoryIds.push(markerCat.id)

    const items = CATEGORY_DATA.slice(0, CAT_COUNT - 1).map((c, i) => ({
      ...c,
      slug: `${c.slug}-${faker.string.alphanumeric(4)}`,
      sortOrder: i + 1,
      parentId: i < 5 ? null : pick(categoryIds),
    }))

    const r = await runBatch(items, 5, async (cat) => {
      const { data } = await apiCall<HasId>('POST', '/product-categories/', cat)
      if (data) categoryIds.push(data.id)
    })
    track(r)
    console.log(
      `  ✓ Categories: ${r.ok} created${r.fail > 0 ? `, ${r.fail} failed` : ''}\n`,
    )
  }

  const PRODUCT_COUNT = Math.max(1, Math.floor(500 * SCALE))
  step(3, `Creating ${PRODUCT_COUNT} products`)
  const productIds: string[] = []
  {
    const items = Array.from({ length: PRODUCT_COUNT }, () => {
      const { name, slug } = generateProductName()
      return {
        name,
        slug,
        description: faker.lorem.sentence(),
        isActive: Math.random() > 0.1,
        categoryId: pick(categoryIds),
      }
    })

    const r = await runBatch(items, 10, async (p) => {
      const { data } = await apiCall<HasId>('POST', '/products/', p)
      if (data) productIds.push(data.id)
    })
    track(r)
    console.log(
      `  ✓ Products: ${r.ok} created${r.fail > 0 ? `, ${r.fail} failed` : ''}\n`,
    )
  }

  const VARIANT_COUNT = Math.max(1, Math.floor(1500 * SCALE))
  step(4, `Creating ~${VARIANT_COUNT} variants`)
  const variantIds: string[] = []
  {
    const variantsPerProduct = VARIANT_COUNT / productIds.length
    const items: Array<{ productId: string; body: Record<string, unknown> }> =
      []

    for (const productId of productIds) {
      const count = Math.max(
        1,
        Math.round(variantsPerProduct + (Math.random() - 0.5) * 2),
      )
      for (let v = 0; v < count && items.length < VARIANT_COUNT; v++) {
        items.push({
          productId,
          body: {
            sku: `SKU-${faker.string.alphanumeric(3)}-${faker.string.numeric(5)}`,
            name: `Var ${v + 1}`,
            price: randFloat(1000, 10_000_000),
            unit: pick(UNITS),
            attributes: generateVariantAttributes(),
            isActive: Math.random() > 0.05,
          },
        })
      }
    }

    const r = await runBatch(items, 20, async ({ productId, body }) => {
      const { data } = await apiCall<HasId>(
        'POST',
        `/products/${productId}/variants/`,
        body,
      )
      if (data) variantIds.push(data.id)
    })
    track(r)
    console.log(
      `  ✓ Variants: ${r.ok} created${r.fail > 0 ? `, ${r.fail} failed` : ''}\n`,
    )
  }

  step(5, 'Uploading media via S3')
  const mediaIds: string[] = []
  {
    const scriptDir = import.meta.dir
    const files = [
      { path: `${scriptDir}/img-1.png`, contentType: 'image/png' },
      { path: `${scriptDir}/img-2.png`, contentType: 'image/png' },
      { path: `${scriptDir}/img-3.jpg`, contentType: 'image/jpeg' },
    ]

    for (const f of files) {
      try {
        const file = Bun.file(f.path)
        const { data: presign, status: s1 } = await apiCall<
          HasId & { uploadUrl: string }
        >('POST', '/uploads/presign', {
          filename: f.path.split('/').pop()!,
          contentType: f.contentType,
          size: file.size,
          purpose: 'products',
        })

        if (s1 !== 201 || !presign) {
          console.error(`  ✗ Failed to presign ${f.path.split('/').pop()}`)
          continue
        }

        const uploaded = await putFile(presign.uploadUrl, file, f.contentType)
        if (!uploaded) {
          console.error(`  ✗ S3 upload failed for ${f.path.split('/').pop()}`)
          continue
        }

        const { data: media, status: s2 } = await apiCall<HasId>(
          'POST',
          `/uploads/${presign.id}/confirm`,
        )
        if (s2 === 200 && media) {
          mediaIds.push(media.id)
          console.log(`  ✓ Uploaded ${f.path.split('/').pop()}`)
        }
      } catch (e: unknown) {
        console.error(`  ✗ Upload error: ${e}`)
      }
    }
    console.log(`  ✓ Media: ${mediaIds.length} uploaded\n`)
  }

  const IMAGE_COUNT = Math.max(0, Math.floor(300 * SCALE))
  if (mediaIds.length > 0 && IMAGE_COUNT > 0) {
    step(6, `Creating ${IMAGE_COUNT} variant images`)
    {
      const targetVariants = [...variantIds]
        .sort(() => Math.random() - 0.5)
        .slice(0, IMAGE_COUNT)
      const items = targetVariants.map((variantId) => ({
        variantId,
        mediaId: pick(mediaIds),
        altText: faker.lorem.words(3),
      }))

      const r = await runBatch(
        items,
        10,
        async ({ variantId, mediaId, altText }) => {
          await apiCall('POST', `/variants/${variantId}/images`, {
            mediaId,
            altText,
          })
        },
      )
      track(r)
      console.log(
        `  ✓ Variant images: ${r.ok} created${r.fail > 0 ? `, ${r.fail} failed` : ''}\n`,
      )
    }
  }

  const WH_COUNT = Math.max(1, Math.floor(5 * SCALE))
  step(7, `Creating ${WH_COUNT} warehouses`)
  const warehouseIds: string[] = []
  {
    const items = WAREHOUSE_CITIES.slice(0, WH_COUNT).map((w) => ({
      name: `${w.name} ${faker.string.alphanumeric(3)}`,
      address: w.address,
      isActive: true,
    }))

    const r = await runBatch(items, WH_COUNT, async (w) => {
      const { data } = await apiCall<HasId>('POST', '/warehouses/', w)
      if (data) warehouseIds.push(data.id)
    })
    track(r)
    console.log(
      `  ✓ Warehouses: ${r.ok} created${r.fail > 0 ? `, ${r.fail} failed` : ''}\n`,
    )
  }

  const SUPPLIER_COUNT = Math.max(1, Math.floor(50 * SCALE))
  step(8, `Creating ${SUPPLIER_COUNT} suppliers`)
  const supplierIds: string[] = []
  {
    const items = Array.from({ length: SUPPLIER_COUNT }, () => ({
      name: faker.company.name(),
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number({ style: 'national' }),
      address: `${faker.location.streetAddress()}, ${faker.location.city()}`,
    }))

    const r = await runBatch(items, 10, async (s) => {
      const { data } = await apiCall<HasId>('POST', '/suppliers/', s)
      if (data) supplierIds.push(data.id)
    })
    track(r)
    console.log(
      `  ✓ Suppliers: ${r.ok} created${r.fail > 0 ? `, ${r.fail} failed` : ''}\n`,
    )
  }

  const CUSTOMER_COUNT = Math.max(1, Math.floor(100 * SCALE))
  step(9, `Creating ${CUSTOMER_COUNT} customers`)
  const customerIds: string[] = []
  {
    const items = Array.from({ length: CUSTOMER_COUNT }, () => ({
      name: `${faker.person.firstName()} ${faker.person.lastName()}`,
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number({ style: 'national' }),
      address: `${faker.location.streetAddress()}, ${faker.location.city()}`,
    }))

    const r = await runBatch(items, 10, async (c) => {
      const { data } = await apiCall<HasId>('POST', '/customers/', c)
      if (data) customerIds.push(data.id)
    })
    track(r)
    console.log(
      `  ✓ Customers: ${r.ok} created${r.fail > 0 ? `, ${r.fail} failed` : ''}\n`,
    )
  }

  const PO_COUNT = Math.max(1, Math.floor(250 * SCALE))
  step(10, `Creating ${PO_COUNT} purchase orders`)
  const purchaseOrders: POData[] = []
  {
    const items = Array.from({ length: PO_COUNT }, () => {
      const itemCount = randInt(1, 5)
      const variants = [...variantIds]
        .sort(() => Math.random() - 0.5)
        .slice(0, itemCount)
      const daysAgo = randInt(0, 90)
      return {
        supplierId: pick(supplierIds),
        warehouseId: pick(warehouseIds),
        orderedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
        note: Math.random() > 0.7 ? faker.lorem.sentence() : undefined,
        items: variants.map((vId) => ({
          variantId: vId,
          quantity: randInt(1, 100),
          unitCost: randFloat(5000, 500_000),
        })),
      }
    })

    const r = await runBatch(items, 5, async (po) => {
      const { data } = await apiCall<POData>('POST', '/purchase-orders/', po)
      if (data) purchaseOrders.push(data)
    })
    track(r)
    console.log(
      `  ✓ Purchase orders: ${r.ok} created${r.fail > 0 ? `, ${r.fail} failed` : ''}\n`,
    )
  }

  const SO_COUNT = Math.max(1, Math.floor(500 * SCALE))
  step(11, `Creating ${SO_COUNT} sales orders`)
  const salesOrders: SOData[] = []
  {
    const items = Array.from({ length: SO_COUNT }, () => {
      const itemCount = randInt(1, 5)
      const variants = [...variantIds]
        .sort(() => Math.random() - 0.5)
        .slice(0, itemCount)
      const daysAgo = randInt(0, 90)
      const useCustomer = Math.random() > 0.2
      const methods = ['CASH', 'QRIS', 'TRANSFER', 'CARD'] as const
      return {
        customerId: useCustomer ? pick(customerIds) : undefined,
        warehouseId: pick(warehouseIds),
        guestName: !useCustomer ? faker.person.fullName() : undefined,
        guestEmail: !useCustomer
          ? faker.internet.email().toLowerCase()
          : undefined,
        orderedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
        note: Math.random() > 0.7 ? faker.lorem.sentence() : undefined,
        paymentMethod: pick(methods),
        items: variants.map((vId) => ({
          variantId: vId,
          quantity: randInt(1, 50),
          unitPrice: randFloat(10_000, 2_000_000),
        })),
      }
    })

    const r = await runBatch(items, 5, async (so) => {
      const { data } = await apiCall<SOData>('POST', '/sales-orders/', so)
      if (data) salesOrders.push(data)
    })
    track(r)
    console.log(
      `  ✓ Sales orders: ${r.ok} created${r.fail > 0 ? `, ${r.fail} failed` : ''}\n`,
    )
  }

  step(12, 'Advancing purchase order statuses')
  {
    const shuffled = [...purchaseOrders].sort(() => Math.random() - 0.5)
    const toConfirm = shuffled.slice(0, Math.floor(shuffled.length * 0.6))
    const toShip: string[] = []
    const toReceive: string[] = []
    const toComplete: string[] = []

    if (toConfirm.length > 0) {
      const r = await runBatch(toConfirm, 5, async (po) => {
        const { status } = await apiCall('PATCH', `/purchase-orders/${po.id}`, {
          status: 'CONFIRMED',
        })
        if (status === 200) {
          if (Math.random() < 0.35) toShip.push(po.id)
          else if (Math.random() < 0.5) toReceive.push(po.id)
        }
      })
      track(r)
      console.log(`  → Confirmed: ${r.ok}`)
    }

    if (toShip.length > 0) {
      const r = await runBatch(toShip, 5, async (id) => {
        const { status } = await apiCall('PATCH', `/purchase-orders/${id}`, {
          status: 'SHIPPED',
        })
        if (status === 200 && Math.random() < 0.6) toReceive.push(id)
      })
      track(r)
      console.log(`  → Shipped: ${r.ok}`)
    }

    if (toReceive.length > 0) {
      const receiveItems = toReceive
        .map((id) => {
          const po = purchaseOrders.find((p) => p.id === id)
          return {
            poId: id,
            items: (po?.items || []).map((it) => ({
              itemId: it.id,
              receivedQty: it.quantity,
            })),
          }
        })
        .filter((r) => r.items.length > 0)

      const r = await runBatch(receiveItems, 5, async ({ poId, items }) => {
        const { status } = await apiCall(
          'POST',
          `/purchase-orders/${poId}/receive`,
          { items },
        )
        if (status === 200) toComplete.push(poId)
      })
      track(r)
      console.log(`  → Received: ${r.ok}`)
    }

    if (toComplete.length > 0) {
      const r = await runBatch(toComplete, 5, async (id) => {
        await apiCall('PATCH', `/purchase-orders/${id}`, {
          status: 'COMPLETED',
        })
      })
      track(r)
      console.log(`  → Completed: ${r.ok}`)
    }

    const toCancel = shuffled
      .filter(
        (po) =>
          !toShip.includes(po.id) &&
          !toReceive.includes(po.id) &&
          !toComplete.includes(po.id),
      )
      .slice(0, Math.floor(shuffled.length * 0.05))

    if (toCancel.length > 0) {
      const r = await runBatch(toCancel, 5, async (po) => {
        await apiCall('PATCH', `/purchase-orders/${po.id}`, {
          status: 'CANCELLED',
        })
      })
      track(r)
      console.log(`  → Cancelled: ${r.ok}`)
    }
    console.log()
  }

  step(13, 'Advancing sales order statuses')
  {
    const shuffled = [...salesOrders].sort(() => Math.random() - 0.5)
    const toConfirm = shuffled.slice(0, Math.floor(shuffled.length * 0.7))
    const toShip: string[] = []
    const toDeliver: string[] = []
    const toComplete: string[] = []

    if (toConfirm.length > 0) {
      const r = await runBatch(toConfirm, 5, async (so) => {
        const { status } = await apiCall('PATCH', `/sales-orders/${so.id}`, {
          status: 'CONFIRMED',
        })
        if (status === 200 && Math.random() < 0.6) toShip.push(so.id)
      })
      track(r)
      console.log(`  → Confirmed: ${r.ok}`)
    }

    if (toShip.length > 0) {
      const r = await runBatch(toShip, 5, async (id) => {
        const { status } = await apiCall('PATCH', `/sales-orders/${id}`, {
          status: 'SHIPPED',
        })
        if (status === 200 && Math.random() < 0.7) toDeliver.push(id)
      })
      track(r)
      console.log(`  → Shipped: ${r.ok}`)
    }

    if (toDeliver.length > 0) {
      const r = await runBatch(toDeliver, 5, async (id) => {
        const { status } = await apiCall('PATCH', `/sales-orders/${id}`, {
          status: 'DELIVERED',
        })
        if (status === 200) toComplete.push(id)
      })
      track(r)
      console.log(`  → Delivered: ${r.ok}`)
    }

    if (toComplete.length > 0) {
      const r = await runBatch(toComplete, 5, async (id) => {
        await apiCall('PATCH', `/sales-orders/${id}`, { status: 'COMPLETED' })
      })
      track(r)
      console.log(`  → Completed: ${r.ok}`)
    }

    const toCancel = shuffled
      .filter(
        (so) =>
          !toShip.includes(so.id) &&
          !toDeliver.includes(so.id) &&
          !toComplete.includes(so.id),
      )
      .slice(0, Math.floor(shuffled.length * 0.05))

    if (toCancel.length > 0) {
      const r = await runBatch(toCancel, 5, async (so) => {
        await apiCall('PATCH', `/sales-orders/${so.id}`, {
          status: 'CANCELLED',
        })
      })
      track(r)
      console.log(`  → Cancelled: ${r.ok}`)
    }
    console.log()
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log('─'.repeat(50))
  console.log(
    `✅ Done in ${elapsed}s — ${totalOk} records, ${totalFail} errors`,
  )
  if (allErrors.length > 0) {
    console.log(
      `\nSample errors (${Math.min(allErrors.length, 10)}/${allErrors.length}):`,
    )
    allErrors.slice(0, 10).forEach((e) => console.log(`  - ${e}`))
  }
  console.log()
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})

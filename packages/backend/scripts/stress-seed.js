/* global __ENV, open */
import http from 'k6/http'
import { check, fail, group } from 'k6'
import exec from 'k6/execution'

const baseUrl = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
const apiKey = __ENV.STRESS_API_KEY
const image = open('./img-1.png', 'b')
const profile = __ENV.LOAD_PROFILE || 'ramping'

if (!['ramping', 'constant', 'smoke'].includes(profile)) {
  throw new Error('LOAD_PROFILE must be ramping, constant, or smoke')
}

const scenarios = {
  ramping: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 10 },
      { duration: '2m', target: 10 },
      { duration: '1m', target: 0 },
      { duration: '1m', target: 20 },
      { duration: '2m', target: 20 },
      { duration: '1m', target: 0 },
      { duration: '1m', target: 50 },
      { duration: '2m', target: 50 },
      { duration: '1m', target: 0 },
      { duration: '1m', target: 100 },
      { duration: '2m', target: 100 },
      { duration: '1m', target: 0 },
      { duration: '1m', target: 200 },
      { duration: '2m', target: 200 },
      { duration: '1m', target: 0 },
      { duration: '1m', target: 250 },
      { duration: '2m', target: 250 },
      { duration: '1m', target: 0 },
    ],
    gracefulRampDown: '30s',
  },
  constant: {
    executor: 'constant-arrival-rate',
    rate: Number(__ENV.RATE || 20),
    timeUnit: '1s',
    duration: __ENV.DURATION || '3m',
    preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 100),
    maxVUs: Number(__ENV.MAX_VUS || 200),
  },
}

export const options = {
  ...(profile === 'smoke' ? {} : { scenarios: { load: scenarios[profile] } }),
  thresholds: {
    checks: ['rate==1'],
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    ...(profile === 'constant' ? { dropped_iterations: ['count==0'] } : {}),
  },
}

function request(method, path, body, expectedStatus, name) {
  const response = http.request(
    method,
    `${baseUrl}${path}`,
    body === undefined ? null : JSON.stringify(body),
    {
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      tags: { name },
    },
  )
  if (
    !check(response, {
      [`${name}: status ${expectedStatus}`]: (r) => r.status === expectedStatus,
    })
  ) {
    fail(`${name} failed: ${response.status} ${response.body}`)
  }
  return name === 'health' ? null : response.json()
}

function create(path, body, name) {
  const data = request('POST', path, body, 201, name)
  if (
    !check(data, { [`${name}: has id`]: (value) => Boolean(value && value.id) })
  ) {
    fail(`${name} did not return an id`)
  }
  return data
}

function attachImage(path, name, suffix) {
  const presign = create(
    '/uploads/presign',
    {
      filename: `stress-${suffix}.png`,
      contentType: 'image/png',
      size: image.byteLength,
      purpose: 'products',
    },
    'presign image',
  )
  if (
    !check(presign, {
      'presign image: has upload URL': (value) => Boolean(value.uploadUrl),
    })
  ) {
    fail('presign image did not return an upload URL')
  }
  const upload = http.put(presign.uploadUrl, image, {
    headers: { 'Content-Type': 'image/png' },
    tags: { name: 'upload image' },
  })
  if (
    !check(upload, {
      'upload image: success': (r) => r.status >= 200 && r.status < 300,
    })
  ) {
    fail(`image upload failed: ${upload.status}`)
  }
  const media = request(
    'POST',
    `/uploads/${presign.id}/confirm`,
    undefined,
    200,
    'confirm image',
  )
  if (
    !check(media, {
      'confirm image: has id': (value) => Boolean(value && value.id),
    })
  ) {
    fail('confirm image did not return an id')
  }
  create(path, { mediaId: media.id, altText: 'Stress test image' }, name)
}

export function setup() {
  if (!apiKey)
    fail('Set STRESS_API_KEY to an API key before running the load test')
  request('GET', '/health', undefined, 200, 'health')
}

export default function () {
  // Include randomness as VU and iteration numbers repeat across separate runs.
  const suffix = `${Date.now()}-${exec.vu.idInTest}-${exec.vu.iterationInScenario}-${Math.random().toString(36).slice(2, 10)}`
  group('catalog', () => {
    const category = create(
      '/product-categories/',
      {
        name: `Stress category ${suffix}`,
        slug: `stress-category-${suffix}`,
      },
      'create category',
    )
    const product = create(
      '/products/',
      {
        name: `Stress product ${suffix}`,
        slug: `stress-product-${suffix}`,
        description: 'Load test product',
        isActive: true,
        categoryId: category.id,
      },
      'create product',
    )
    attachImage(
      `/products/${product.id}/images`,
      'attach product image',
      `product-${suffix}`,
    )
    const variant = create(
      `/products/${product.id}/variants/`,
      {
        sku: `STRESS-${suffix}`,
        name: 'Load test variant',
        price: 10000,
        unit: 'pcs',
        attributes: {},
        isActive: true,
      },
      'create variant',
    )
    attachImage(
      `/variants/${variant.id}/images`,
      'attach variant image',
      `variant-${suffix}`,
    )

    group('orders', () => {
      const warehouse = create(
        '/warehouses/',
        {
          name: `Stress warehouse ${suffix}`,
          address: 'Jakarta',
          isActive: true,
        },
        'create warehouse',
      )
      const supplier = create(
        '/suppliers/',
        {
          name: `Stress supplier ${suffix}`,
        },
        'create supplier',
      )
      const customer = create(
        '/customers/',
        {
          name: `Stress customer ${suffix}`,
        },
        'create customer',
      )
      const purchase = create(
        '/purchase-orders/',
        {
          supplierId: supplier.id,
          warehouseId: warehouse.id,
          items: [{ variantId: variant.id, quantity: 10, unitCost: 5000 }],
        },
        'create purchase order',
      )
      if (
        !check(purchase, {
          'purchase order: has items': (value) =>
            Boolean(value.items && value.items.length && value.items[0].id),
        })
      ) {
        fail('purchase order did not return its item')
      }
      request(
        'PATCH',
        `/purchase-orders/${purchase.id}`,
        { status: 'CONFIRMED' },
        200,
        'confirm purchase order',
      )
      request(
        'PATCH',
        `/purchase-orders/${purchase.id}`,
        { status: 'SHIPPED' },
        200,
        'ship purchase order',
      )
      request(
        'POST',
        `/purchase-orders/${purchase.id}/receive`,
        {
          items: [{ itemId: purchase.items[0].id, receivedQty: 10 }],
        },
        200,
        'receive purchase order',
      )
      request(
        'PATCH',
        `/purchase-orders/${purchase.id}`,
        { status: 'COMPLETED' },
        200,
        'complete purchase order',
      )
      const sale = create(
        '/sales-orders/',
        {
          customerId: customer.id,
          warehouseId: warehouse.id,
          paymentMethod: 'CASH',
          items: [{ variantId: variant.id, quantity: 1, unitPrice: 10000 }],
        },
        'create sales order',
      )
      for (const status of ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED']) {
        request(
          'PATCH',
          `/sales-orders/${sale.id}`,
          { status },
          200,
          `sales order ${status.toLowerCase()}`,
        )
      }
    })
  })
}

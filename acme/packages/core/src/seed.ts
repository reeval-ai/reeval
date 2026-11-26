import type { Category, Coupon, Order, Product, TenantState } from './schemas.ts'

/** The product catalog, with the stock each tenant starts with. */
export const PRODUCTS: readonly Product[] = [
  // audio
  p('prod_001', 'Studio Headphones', 'Closed-back over-ear headphones.', 'audio', 12900, 25),
  p('prod_002', 'Wireless Earbuds', 'Earbuds with a charging case.', 'audio', 7900, 40),
  p('prod_003', 'Bluetooth Speaker', 'Portable speaker, 12 hours of play.', 'audio', 5900, 30),
  p('prod_004', 'USB Microphone', 'Cardioid condenser microphone.', 'audio', 8900, 15),
  p('prod_005', 'Vinyl Turntable', 'Belt-drive turntable with a preamp.', 'audio', 24900, 0),
  p('prod_006', 'Soundbar', 'Compact soundbar with a subwoofer.', 'audio', 17900, 12),
  // computing
  p('prod_007', 'Mechanical Keyboard', 'Hot-swappable 75% keyboard.', 'computing', 11900, 20),
  p('prod_008', 'Ergonomic Mouse', 'Vertical mouse with a quiet click.', 'computing', 4900, 50),
  p('prod_009', 'USB-C Hub', 'Seven ports, 100 W pass-through.', 'computing', 3900, 60),
  p('prod_010', '27-inch Monitor', '4K IPS monitor with USB-C.', 'computing', 32900, 8),
  p('prod_011', 'Laptop Stand', 'Folding aluminum stand.', 'computing', 2900, 45),
  p('prod_012', 'Webcam', '1080p webcam with a privacy cover.', 'computing', 6900, 22),
  // home
  p('prod_013', 'Desk Lamp', 'Dimmable LED lamp.', 'home', 3500, 35),
  p('prod_014', 'Pour-Over Kettle', 'Gooseneck kettle with a thermometer.', 'home', 5500, 18),
  p('prod_015', 'Coffee Grinder', 'Burr grinder, 40 settings.', 'home', 8900, 14),
  p('prod_016', 'Air Purifier', 'HEPA purifier for small rooms.', 'home', 14900, 10),
  p('prod_017', 'Smart Plug', 'Wi-Fi plug with an energy meter.', 'home', 1500, 0),
  p('prod_018', 'Throw Blanket', 'Washable wool blend blanket.', 'home', 4500, 28),
  // outdoors
  p('prod_019', 'Trail Backpack', '28-liter backpack.', 'outdoors', 9900, 16),
  p('prod_020', 'Insulated Bottle', 'Steel bottle, keeps cold for 24 hours.', 'outdoors', 2900, 70),
  p('prod_021', 'Camp Stove', 'Single-burner stove.', 'outdoors', 4900, 21),
  p('prod_022', 'Headlamp', 'Rechargeable 400-lumen headlamp.', 'outdoors', 3900, 33),
  p('prod_023', 'Sleeping Bag', 'Three-season mummy bag.', 'outdoors', 12900, 9),
  p('prod_024', 'Trekking Poles', 'Pair of carbon poles.', 'outdoors', 7900, 19),
]

/** The coupons every tenant has. `EXPIRED20` expired before any clock this service is run on. */
export const COUPONS: readonly Coupon[] = [
  { code: 'WELCOME10', type: 'percent', value: 10, minSubtotalCents: 0, expiresAt: null },
  { code: 'SAVE5', type: 'fixed', value: 500, minSubtotalCents: 5000, expiresAt: null },
  {
    code: 'EXPIRED20',
    type: 'percent',
    value: 20,
    minSubtotalCents: 0,
    expiresAt: '2020-01-01T00:00:00.000Z',
  },
]

/** Payment token that succeeds. */
export const PAYMENT_TOKEN_OK = 'tok_ok'

/** Payment token that is declined. Any other token succeeds. */
export const PAYMENT_TOKEN_DECLINED = 'tok_declined'

/** The time of the seeded orders. */
export const SEED_TIME = '2026-01-01T00:00:00.000Z'

/**
 * A fresh copy of the state every tenant starts with, and that `reset` returns to: full stock, a
 * `paid` order (`order_0001`) and a `shipped` order (`order_0002`), and no carts.
 */
export function seedState(): TenantState {
  return {
    carts: {},
    orders: {
      order_0001: seedOrder('order_0001', 'cart_seed_1', 'paid', [
        ['prod_001', 1],
        ['prod_008', 2],
      ]),
      order_0002: seedOrder('order_0002', 'cart_seed_2', 'shipped', [['prod_013', 1]]),
    },
    stock: Object.fromEntries(PRODUCTS.map((product) => [product.id, product.stock])),
    counters: { cart: 0, order: 2 },
    idempotency: {},
  }
}

function p(
  id: string,
  name: string,
  description: string,
  category: Category,
  priceCents: number,
  stock: number,
): Product {
  return { id, name, description, category, priceCents, stock }
}

function seedOrder(
  id: string,
  cartId: string,
  status: Order['status'],
  lines: [productId: string, quantity: number][],
): Order {
  const items = lines.map(([productId, quantity]) => {
    const product = PRODUCTS.find((candidate) => candidate.id === productId)
    if (!product) throw new Error(`seed references unknown product ${productId}`)
    return {
      productId,
      name: product.name,
      unitPriceCents: product.priceCents,
      quantity,
      lineTotalCents: product.priceCents * quantity,
    }
  })
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0)
  return {
    id,
    cartId,
    status,
    items,
    subtotalCents,
    discountCents: 0,
    totalCents: subtotalCents,
    couponCode: null,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  }
}

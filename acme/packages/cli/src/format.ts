import type { Cart, CartItem, Order, Page, Product, ResetResult } from '@acme/core'

/** Formats integer cents as dollars with two decimals, such as `$12.50`. */
export function money(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

function table(header: string[], rows: string[][]): string {
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => (row[column] ?? '').length)),
  )
  const line = (cells: string[]) =>
    cells
      .map((cell, column) => cell.padEnd(widths[column] ?? 0))
      .join('  ')
      .trimEnd()
  return [line(header), ...rows.map(line)].join('\n')
}

function fields(pairs: [string, string | number][]): string {
  return pairs.map(([key, value]) => `${key}: ${value}`).join('\n')
}

function list<T>(page: Page<T>, header: string[], row: (item: T) => string[]): string {
  const body = page.data.length === 0 ? 'no results' : table(header, page.data.map(row))
  return page.nextCursor === null ? body : `${body}\nnext cursor: ${page.nextCursor}`
}

function itemsTable(items: CartItem[]): string {
  return table(
    ['PRODUCT', 'QTY', 'UNIT', 'TOTAL', 'NAME'],
    items.map((item) => [
      item.productId,
      String(item.quantity),
      money(item.unitPriceCents),
      money(item.lineTotalCents),
      item.name,
    ]),
  )
}

/** A page of products as a table. */
export function productList(page: Page<Product>): string {
  return list(page, ['ID', 'NAME', 'CATEGORY', 'PRICE', 'STOCK'], (product) => [
    product.id,
    product.name,
    product.category,
    money(product.priceCents),
    String(product.stock),
  ])
}

/** One product as key/value lines. */
export function product(item: Product): string {
  return fields([
    ['id', item.id],
    ['name', item.name],
    ['description', item.description],
    ['category', item.category],
    ['price', money(item.priceCents)],
    ['stock', item.stock],
  ])
}

/** One cart as key/value lines, then its items as a table. */
export function cart(item: Cart): string {
  const head = fields([
    ['id', item.id],
    ['items', item.items.length],
    ['subtotal', money(item.subtotalCents)],
    ['created', item.createdAt],
    ['updated', item.updatedAt],
  ])
  return item.items.length === 0 ? head : `${head}\n\n${itemsTable(item.items)}`
}

/** One order as key/value lines, then its items as a table. */
export function order(item: Order): string {
  const head = fields([
    ['id', item.id],
    ['status', item.status],
    ['cart', item.cartId],
    ['subtotal', money(item.subtotalCents)],
    ['discount', money(item.discountCents)],
    ['coupon', item.couponCode ?? '-'],
    ['total', money(item.totalCents)],
    ['created', item.createdAt],
    ['updated', item.updatedAt],
  ])
  return item.items.length === 0 ? head : `${head}\n\n${itemsTable(item.items)}`
}

/** A page of orders as a table. */
export function orderList(page: Page<Order>): string {
  return list(page, ['ID', 'STATUS', 'QTY', 'TOTAL', 'CREATED'], (item) => [
    item.id,
    item.status,
    String(item.items.reduce((sum, line) => sum + line.quantity, 0)),
    money(item.totalCents),
    item.createdAt,
  ])
}

/** The result of a reset. */
export function reset(_result: ResetResult): string {
  return 'ok'
}

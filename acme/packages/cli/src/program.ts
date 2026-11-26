import {
  type AcmeServices,
  MAX_ITEM_QUANTITY,
  type OrderListInput,
  PAGE_LIMIT,
  PAYMENT_TOKEN_DECLINED,
  type ProductListInput,
} from '@acme/core'
import { Command, InvalidArgumentError } from 'commander'
import * as format from './format.ts'

/** What the program needs from its environment. */
export interface ProgramDeps {
  /** Builds the services on first use, so `--help` works with no API key. */
  services: () => AcmeServices
  /** Receives the normal output and the help asked for, newline included. */
  stdout: (text: string) => void
  /** Receives usage errors, with the help they show, and diagnostics, newline included. */
  stderr: (text: string) => void
}

const LIMIT_HELP = `page size, 1 to ${PAGE_LIMIT.max} (default ${PAGE_LIMIT.default})`
const CURSOR_HELP = 'the "next cursor" line of the previous page'

/** Whether `--json` is set on the program `createProgram` built. */
export function jsonMode(program: Command): boolean {
  return program.opts<{ json?: boolean }>().json === true
}

function integer(text: string): number {
  if (!/^-?\d+$/.test(text)) throw new InvalidArgumentError('not an integer')
  return Number(text)
}

/**
 * Builds the `acme` command tree. It never exits the process and writes only through `deps`.
 *
 * @param deps - The services and the output streams.
 */
export function createProgram(deps: ProgramDeps): Command {
  const program = new Command('acme')
    .description('Command line client of the acme mock e-commerce service')
    .option('--json', 'print the result as JSON on stdout, and an API error as JSON on stderr')
    .exitOverride()
    .configureOutput({ writeOut: deps.stdout, writeErr: deps.stderr })
    .configureHelp({ showGlobalOptions: true })

  async function emit<T>(result: Promise<T>, render: (value: T) => string): Promise<void> {
    const value = await result
    deps.stdout(`${jsonMode(program) ? JSON.stringify(value, null, 2) : render(value)}\n`)
  }

  const services = () => deps.services()

  const products = program.command('products').description('browse the catalog')
  products
    .command('list')
    .description('list products')
    .option('--q <text>', 'match name and description')
    .option('--category <name>', 'only this category')
    .option('--limit <n>', LIMIT_HELP, integer)
    .option('--cursor <c>', CURSOR_HELP)
    .action((options: ProductListInput) =>
      emit(services().products.list(options), format.productList),
    )
  products
    .command('get')
    .description('show a product')
    .argument('<id>', 'the product id, such as prod_001')
    .action((id) => emit(services().products.get(id), format.product))

  const carts = program.command('carts').description('build a cart')
  carts
    .command('create')
    .description('create an empty cart')
    .action(() => emit(services().carts.create(), format.cart))
  carts
    .command('get')
    .description('show a cart')
    .argument('<id>', 'the cart id, such as cart_0001')
    .action((id) => emit(services().carts.get(id), format.cart))
  carts
    .command('add')
    .description('add a product to a cart, or add to its quantity if it is already there')
    .argument('<id>', 'the cart id')
    .argument('<productId>', 'the product id')
    .option('--quantity <n>', `how many to add, 1 to ${MAX_ITEM_QUANTITY}`, integer, 1)
    .action((id, productId, options: { quantity: number }) =>
      emit(services().carts.addItem(id, { productId, quantity: options.quantity }), format.cart),
    )
  carts
    .command('update')
    .description('set the quantity of a product in a cart')
    .argument('<id>', 'the cart id')
    .argument('<productId>', 'the product id')
    .requiredOption('--quantity <n>', `the new quantity, 1 to ${MAX_ITEM_QUANTITY}`, integer)
    .action((id, productId, options: { quantity: number }) =>
      emit(services().carts.updateItem(id, productId, { quantity: options.quantity }), format.cart),
    )
  carts
    .command('remove')
    .description('remove a product from a cart')
    .argument('<id>', 'the cart id')
    .argument('<productId>', 'the product id')
    .action((id, productId) => emit(services().carts.removeItem(id, productId), format.cart))

  const orders = program.command('orders').description('place and manage orders')
  orders
    .command('create')
    .description('check out a cart')
    .requiredOption('--cart <id>', 'the cart to check out')
    .requiredOption(
      '--payment-token <t>',
      `${PAYMENT_TOKEN_DECLINED} is declined, any other token (such as tok_ok) succeeds`,
    )
    .option('--coupon <code>', 'a coupon code')
    .option(
      '--idempotency-key <k>',
      'a key used before returns the order it created, and creates nothing',
    )
    .action(
      (options: { cart: string; paymentToken: string; coupon?: string; idempotencyKey?: string }) =>
        emit(
          services().orders.create({
            cartId: options.cart,
            paymentToken: options.paymentToken,
            ...(options.coupon === undefined ? {} : { couponCode: options.coupon }),
            ...(options.idempotencyKey === undefined
              ? {}
              : { idempotencyKey: options.idempotencyKey }),
          }),
          format.order,
        ),
    )
  orders
    .command('list')
    .description('list orders')
    .option('--status <s>', 'paid, shipped or canceled')
    .option('--limit <n>', LIMIT_HELP, integer)
    .option('--cursor <c>', CURSOR_HELP)
    .action((options: OrderListInput) => emit(services().orders.list(options), format.orderList))
  orders
    .command('get')
    .description('show an order')
    .argument('<id>', 'the order id, such as order_0001')
    .action((id) => emit(services().orders.get(id), format.order))
  orders
    .command('cancel')
    .description('cancel a paid order and return its stock')
    .argument('<id>', 'the order id')
    .action((id) => emit(services().orders.cancel(id), format.order))

  program
    .command('reset')
    .description('restore the seed data of this API key')
    .action(() => emit(services().reset(), format.reset))

  return program
}

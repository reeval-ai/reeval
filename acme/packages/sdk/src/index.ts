import {
  type AcmeServices,
  type AddCartItemInput,
  type Cart,
  type CartService,
  type CreateOrderInput,
  errorFromEnvelope,
  type Order,
  type OrderListInput,
  type OrderService,
  type Page,
  type Product,
  type ProductListInput,
  type ProductService,
  type ResetResult,
  type UpdateCartItemInput,
} from '@acme/core'

export type {
  AcmeServices,
  AddCartItemInput,
  Cart,
  CartItem,
  CartService,
  Coupon,
  CreateOrderInput,
  ErrorCode,
  ErrorEnvelope,
  Order,
  OrderListInput,
  OrderService,
  OrderStatus,
  Page,
  Product,
  ProductListInput,
  ProductService,
  ResetResult,
  UpdateCartItemInput,
} from '@acme/core'
export { AcmeError, isAcmeError } from '@acme/core'

const DEFAULT_BASE_URL = 'http://localhost:8787'
const DEFAULT_TIMEOUT_MS = 30_000
/** The longest delay `setTimeout` keeps; a longer one fires at once. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1

/** Options of the `Acme` client. */
export interface AcmeOptions {
  /** The API key. Defaults to `ACME_API_KEY`. */
  apiKey?: string
  /** The server's origin. Defaults to `ACME_BASE_URL`, then `http://localhost:8787`. */
  baseUrl?: string
  /** The `fetch` to send requests with. Defaults to the global one. */
  fetch?: typeof fetch
  /**
   * Milliseconds a request may take, the response body included, before it rejects with an
   * `AcmeConnectionError`. Defaults to 30000. 0 disables the timeout.
   */
  timeoutMs?: number
}

/**
 * Thrown when no usable acme response arrived: the network failed, or the response was not JSON
 * or not the error envelope. An error the server reported is an `AcmeError` instead.
 */
export class AcmeConnectionError extends Error {
  /** The HTTP status, when a response arrived. */
  readonly status: number | undefined

  /**
   * @param message - A message for a person.
   * @param options - The HTTP `status` of the response, if any, and the underlying `cause`.
   */
  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'AcmeConnectionError'
    this.status = options.status
  }
}

type Query = Record<string, string | number | undefined>

interface RequestOptions {
  query?: Query
  body?: unknown
  headers?: Record<string, string>
}

/** A client for the acme HTTP API. */
export class Acme implements AcmeServices {
  /** The product catalog. */
  readonly products: ProductService
  /** Carts. */
  readonly carts: CartService
  /** Orders. */
  readonly orders: OrderService

  readonly #apiKey: string
  readonly #baseUrl: string
  readonly #fetch: typeof fetch
  readonly #timeoutMs: number

  /**
   * @param options - The API key, server, `fetch` and timeout. Each falls back to its default.
   * @throws Error when no API key is given and `ACME_API_KEY` is not set, when the key cannot be
   * sent in an HTTP header, when the base URL is not an http or https URL, or when `timeoutMs`
   * is not an integer from 0 to 2147483647.
   */
  constructor(options: AcmeOptions = {}) {
    const apiKey = options.apiKey ?? env('ACME_API_KEY')
    if (!apiKey) {
      throw new Error('Acme needs an API key: pass `apiKey` or set ACME_API_KEY')
    }
    // fetch's own refusal of an invalid header value quotes the value, which would leak the key.
    if (!isHeaderValue(`Bearer ${apiKey}`)) {
      throw new Error(
        'The API key has a line break or a character an HTTP header cannot carry: check `apiKey` or ACME_API_KEY',
      )
    }
    this.#apiKey = apiKey
    this.#baseUrl = (options.baseUrl ?? env('ACME_BASE_URL') ?? DEFAULT_BASE_URL).replace(
      /\/+$/,
      '',
    )
    if (!isBaseUrl(this.#baseUrl)) {
      throw new Error(
        `Acme needs an http or https base URL with no query or fragment, such as ${DEFAULT_BASE_URL}: check \`baseUrl\` or ACME_BASE_URL (got "${this.#baseUrl}")`,
      )
    }
    this.#fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    if (!Number.isInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new Error(
        `Acme needs a timeoutMs that is an integer from 0 to ${MAX_TIMEOUT_MS}, where 0 means no timeout (got ${timeoutMs})`,
      )
    }
    this.#timeoutMs = timeoutMs

    const request = <T>(method: string, path: string, options?: RequestOptions) =>
      this.#request<T>(method, path, options)

    // Inputs are sent whole, unknown fields included, so the server refuses those fields.
    this.products = {
      list: (input?: ProductListInput) =>
        request<Page<Product>>('GET', '/products', { query: { ...input } }),
      get: (id) => request<Product>('GET', `/products/${seg(id)}`),
    }

    this.carts = {
      create: () => request<Cart>('POST', '/carts'),
      get: (id) => request<Cart>('GET', `/carts/${seg(id)}`),
      addItem: (cartId: string, input: AddCartItemInput) =>
        request<Cart>('POST', `/carts/${seg(cartId)}/items`, { body: input }),
      updateItem: (cartId: string, productId: string, input: UpdateCartItemInput) =>
        request<Cart>('PATCH', `/carts/${seg(cartId)}/items/${seg(productId)}`, { body: input }),
      removeItem: (cartId, productId) =>
        request<Cart>('DELETE', `/carts/${seg(cartId)}/items/${seg(productId)}`),
    }

    this.orders = {
      create: ({ idempotencyKey, ...body }: CreateOrderInput) =>
        request<Order>('POST', '/orders', {
          body,
          headers: idempotencyKey === undefined ? {} : { 'Idempotency-Key': idempotencyKey },
        }),
      list: (input?: OrderListInput) =>
        request<Page<Order>>('GET', '/orders', { query: { ...input } }),
      get: (id) => request<Order>('GET', `/orders/${seg(id)}`),
      cancel: (id) => request<Order>('POST', `/orders/${seg(id)}/cancel`),
    }
  }

  /** Restores the seed data of this API key. */
  reset(): Promise<ResetResult> {
    return this.#request<ResetResult>('POST', '/reset')
  }

  async #request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.#baseUrl}/v1${path}`)
    for (const [name, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(name, String(value))
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#apiKey}`,
      Accept: 'application/json',
      ...options.headers,
    }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    const init: RequestInit = {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }
    if (this.#timeoutMs === 0) return this.#send<T>(method, url, init)

    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), this.#timeoutMs)
    try {
      return await this.#send<T>(method, url, { ...init, signal: timeout.signal })
    } catch (error) {
      if (!timeout.signal.aborted) throw error
      throw new AcmeConnectionError(`${method} ${url.href} timed out after ${this.#timeoutMs} ms`, {
        cause: error,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  async #send<T>(method: string, url: URL, init: RequestInit): Promise<T> {
    let response: Response
    try {
      response = await this.#fetch(url, init)
    } catch (cause) {
      throw new AcmeConnectionError(`${method} ${url.href} failed: ${describe(cause)}`, { cause })
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch (cause) {
      throw new AcmeConnectionError(
        `${method} ${url.href} answered ${response.status} with a body that is not JSON`,
        { status: response.status, cause },
      )
    }

    if (response.ok) return payload as T
    throw (
      errorFromEnvelope(response.status, payload) ??
      new AcmeConnectionError(
        `${method} ${url.href} answered ${response.status} without an acme error envelope`,
        { status: response.status },
      )
    )
  }
}

function seg(value: string): string {
  return encodeURIComponent(value)
}

/** The messages of an error and its causes, since `fetch failed` alone names no reason. */
function describe(error: unknown): string {
  const reasons: string[] = []
  let current: unknown = error
  for (let depth = 0; current !== undefined && depth < 5; depth++) {
    const text = reason(current)
    if (text !== '') reasons.push(text)
    current = current instanceof Error ? current.cause : undefined
  }
  return reasons.join(': ') || 'unknown error'
}

function reason(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  if (error.message !== '') return error.message
  return error instanceof AggregateError ? error.errors.map(reason).join(', ') : ''
}

function isHeaderValue(value: string): boolean {
  try {
    new Headers({ authorization: value })
    return true
  } catch {
    return false
  }
}

function isBaseUrl(value: string): boolean {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return (url.protocol === 'http:' || url.protocol === 'https:') && !url.search && !url.hash
}

function env(name: string): string | undefined {
  return typeof process === 'undefined' ? undefined : process.env?.[name] || undefined
}

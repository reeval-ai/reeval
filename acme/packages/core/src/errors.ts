import { z } from 'zod'

/** The HTTP status of each error code. */
export const ERROR_STATUS = {
  unauthorized: 401,
  invalid_request: 400,
  not_found: 404,
  insufficient_stock: 409,
  cart_empty: 409,
  payment_declined: 402,
  coupon_invalid: 422,
  order_not_cancelable: 409,
  internal_error: 500,
} as const

/** One of the error codes of the API. */
export type ErrorCode = keyof typeof ERROR_STATUS

/** The schema of the error codes. */
export const ErrorCodeSchema = z.enum(Object.keys(ERROR_STATUS) as [ErrorCode, ...ErrorCode[]])

/** The body of every error response. */
export const ErrorEnvelopeSchema = z.object({
  error: z.object({ code: ErrorCodeSchema, message: z.string() }),
})
/** The body of every error response. */
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>

/** An error with a stable `code` and the HTTP `status` it maps to. */
export class AcmeError extends Error {
  readonly code: ErrorCode
  readonly status: number

  /**
   * @param code - The error code.
   * @param message - A message for a person.
   * @param status - Overrides the code's status, for a response from a server.
   */
  constructor(code: ErrorCode, message: string, status: number = ERROR_STATUS[code]) {
    super(message)
    this.name = 'AcmeError'
    this.code = code
    this.status = status
  }

  /** The envelope this error is sent as. */
  toEnvelope(): ErrorEnvelope {
    return { error: { code: this.code, message: this.message } }
  }
}

/** Whether a value is an `AcmeError`, also across copies of this package. */
export function isAcmeError(value: unknown): value is AcmeError {
  return value instanceof Error && value.name === 'AcmeError' && 'code' in value
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

/** Whether a value is an `AcmeConnectionError`, also across copies of this package. */
export function isAcmeConnectionError(value: unknown): value is AcmeConnectionError {
  return value instanceof Error && value.name === 'AcmeConnectionError'
}

/**
 * Turns a failed zod parse into an `invalid_request` error.
 *
 * @param error - The zod error.
 */
export function invalidRequest(error: z.ZodError): AcmeError {
  const message = error.issues
    .map((issue) =>
      issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    )
    .join('; ')
  return new AcmeError('invalid_request', message)
}

/**
 * Rebuilds the error from an error response, or null when the body is not an envelope.
 *
 * @param status - The HTTP status of the response.
 * @param body - The parsed JSON body.
 */
export function errorFromEnvelope(status: number, body: unknown): AcmeError | null {
  const parsed = ErrorEnvelopeSchema.safeParse(body)
  if (!parsed.success) return null
  return new AcmeError(parsed.data.error.code, parsed.data.error.message, status)
}

import { exports } from 'cloudflare:workers'

let counter = 0

/** A key no other test uses, so tests do not share a Durable Object. */
export function freshKey(label: string): string {
  counter += 1
  return `acme_test_${label}_${crypto.randomUUID()}_${counter}`
}

/** Fetches from the Worker's default export, as an HTTP client would. */
export function workerFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(new Request(input, init))
}

/** Calls `/v1` on the Worker as the tenant of `key` and parses the JSON answer. */
export async function v1<T = unknown>(
  key: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const res = await workerFetch(`http://acme.test${path}`, {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json()) as T }
}

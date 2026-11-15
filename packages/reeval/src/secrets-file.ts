// `REEVAL_SECRETS_FILE`: secrets handed to reeval with the mode that decides who sees each value.
// reeval reads the file once as it starts, before it loads a config, and deletes it. A `readable`
// value goes into the environment as a variable would; a `brokered`, `filled` or `sandbox` one is
// held here, out of every environment, and the environment gets a placeholder in its place, so the
// eval code reads a placeholder. An attempt's worker asks the main process for the held values over
// the run's service channel, and the environment's `secret()`s take them from there: a brokered one
// reaches only the egress gateway, which swaps it in on its hosts, a filled one too, with the
// requests it's swapped into sent to the file's filler, and a sandbox one only the agent's sandbox.
// The eval code runs in the worker that holds them, so this keeps values out of its reach by
// accident, not against code that reads reeval's own state.
import {
  type Filler,
  fillerUrlProblem,
  fillHeaders,
  placeholder,
  type SubstituteIn,
} from '@reeval/sandbox-docker'
import { UsageError } from './errors.ts'
import { isPlaceholder, registerSecret } from './redact.ts'
import { callService } from './scheduler/services.ts'
import { claimSecretsFile, SECRETS_FILE_VAR } from './secrets-file-take.ts'
import { nativeFetch } from './startup.ts'

/** The run service a worker fetches the held values from. */
export const SECRETS_SERVICE = 'secrets'

/**
 * A secret reeval holds out of the environment: its mode, a brokered or filled one's hosts, and its
 * value. A brokered or filled one without hosts goes where each use sends it: a harness's
 * credential to the harness's endpoints, a key for reeval's own model calls to its provider's or
 * gateway's API.
 *
 * A filled one's value is a reference the runner that wrote the file issued, which `filler` swaps
 * for the value it stands for: each request it's swapped into goes to the filler instead of its
 * host, with the URL it was for (see `@reeval/sandbox-docker`'s `fill.ts`). reeval never reads the
 * reference. Its `in` is where an environment's `secret()` swaps it in when that names none.
 *
 * A brokered or filled one without hosts is kept from the agent, not from the eval code: an
 * environment that names it with `secret.fromEnv(name, { hosts })` decides its hosts, and the eval
 * code writes that environment.
 */
export type HeldSecret =
  | { mode: 'brokered'; hosts?: string[]; value: string }
  | { mode: 'filled'; hosts?: string[]; in?: SubstituteIn[]; filler: Filler; value: string }
  | { mode: 'sandbox'; value: string }

const VAR = /^[A-Za-z_][A-Za-z0-9_]*$/
const HOST = /^(\*\.)?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/

const held = new Map<string, HeldSecret>()
let fetched: Promise<void> | undefined

/** A brokered or filled secret's hosts, lower-cased and checked. */
function hostsOf(
  name: string,
  mode: string,
  hosts: unknown,
  bad: (why: string) => Error,
): string[] {
  if (
    !Array.isArray(hosts) ||
    !hosts.length ||
    !hosts.every((h): h is string => typeof h === 'string' && h.length > 0)
  ) {
    throw bad(`has no hosts for ${name}, which is ${mode}: list them, or leave hosts out`)
  }
  const named = hosts.map((h) => h.toLowerCase())
  const off = named.find((h) => !HOST.test(h))
  if (off !== undefined) {
    throw bad(
      `gives ${name} the host ${JSON.stringify(off)}, which isn't a host name: give the name alone, with no scheme, port or path`,
    )
  }
  return [...new Set(named)]
}

function parse(
  text: string,
  file: string,
): Record<string, HeldSecret | { mode: 'readable'; value: string }> {
  const bad = (why: string) => new UsageError(`${SECRETS_FILE_VAR} names ${file}, which ${why}`)
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch {
    throw bad("isn't JSON")
  }
  const d = doc as { version?: unknown; secrets?: unknown; filler?: unknown } | null
  if (typeof d !== 'object' || d === null || Array.isArray(d)) throw bad("isn't a JSON object")
  if (d.version !== 1) {
    throw bad(`is version ${JSON.stringify(d.version)}, and this reeval reads version 1`)
  }
  if (typeof d.secrets !== 'object' || d.secrets === null || Array.isArray(d.secrets)) {
    throw bad('has no secrets object')
  }
  let filler: Filler | undefined
  if (d.filler !== undefined) {
    const f = d.filler as { url?: unknown; token?: unknown } | null
    if (typeof f?.url !== 'string' || typeof f.token !== 'string' || !f.token) {
      throw bad('has a filler without a url and a token')
    }
    const problem = fillerUrlProblem(f.url)
    if (problem) throw bad(`has a filler whose url ${problem}`)
    filler = { url: f.url, token: f.token }
  }
  const out: Record<string, HeldSecret | { mode: 'readable'; value: string }> = {}
  for (const [name, raw] of Object.entries(d.secrets)) {
    if (!VAR.test(name))
      throw bad(`has a secret named ${JSON.stringify(name)}, which isn't a variable name`)
    const s = raw as { mode?: unknown; hosts?: unknown; in?: unknown; value?: unknown } | null
    if (typeof s?.value !== 'string' || !s.value) throw bad(`has no value for ${name}`)
    if (s.mode === 'brokered' || s.mode === 'filled') {
      const hosts = s.hosts === undefined ? undefined : hostsOf(name, s.mode, s.hosts, bad)
      if (s.mode === 'brokered') {
        out[name] = { mode: 'brokered', ...(hosts && { hosts }), value: s.value }
        continue
      }
      if (!filler) throw bad(`gives ${name} the filled mode, and has no filler to fill it`)
      const places = s.in
      if (
        places !== undefined &&
        (!Array.isArray(places) ||
          !places.length ||
          !places.every((p) => p === 'header' || p === 'query' || p === 'body'))
      ) {
        throw bad(`gives ${name} an in that isn't a list of header, query and body`)
      }
      out[name] = {
        mode: 'filled',
        ...(hosts && { hosts }),
        ...(places && { in: [...new Set(places as SubstituteIn[])] }),
        filler,
        value: s.value,
      }
    } else if (s.mode === 'sandbox' || s.mode === 'readable') {
      out[name] = { mode: s.mode, value: s.value }
    } else {
      throw bad(
        `gives ${name} the mode ${JSON.stringify(s.mode)}, not brokered, filled, sandbox or readable`,
      )
    }
  }
  return out
}

/**
 * Reads and deletes the file `REEVAL_SECRETS_FILE` names, when it's set, and unsets it, so no
 * worker sees it. A name in the file wins over the same name in the environment.
 */
export function readSecretsFile(env: NodeJS.ProcessEnv = process.env): void {
  const taken = claimSecretsFile(env)
  if (!taken) return
  const { file } = taken
  if ('error' in taken) {
    throw new UsageError(
      `${SECRETS_FILE_VAR} names ${file}, which reeval can't read: ${taken.error}`,
    )
  }
  const { text } = taken
  for (const [name, secret] of Object.entries(parse(text, file))) {
    registerSecret(secret.value)
    if (secret.mode === 'filled') registerSecret(secret.filler.token)
    if (secret.mode === 'readable') {
      env[name] = secret.value
      held.delete(name)
      continue
    }
    held.set(name, secret)
    env[name] = placeholder()
  }
}

/** The held secrets, as the main process answers a worker's call for them. */
export const heldSecrets = (): Record<string, HeldSecret> => Object.fromEntries(held)

/**
 * Makes the main process's held secrets this process's, once: a worker fetches them over the
 * run's service channel; the main process already has them.
 */
export function fetchHeldSecrets(): Promise<void> {
  fetched ??= (
    callService(SECRETS_SERVICE, {}, async () => heldSecrets()) as Promise<
      Record<string, HeldSecret>
    >
  ).then(
    (secrets) => {
      for (const [name, secret] of Object.entries(secrets ?? {})) {
        registerSecret(secret.value)
        if (secret.mode === 'filled') registerSecret(secret.filler.token)
        held.set(name, secret)
      }
    },
    // A run without the service (one that read no file) holds nothing.
    () => {},
  )
  return fetched
}

/** The held secret named `name`, which a `secret()` reading that host variable gets. */
export const heldSecret = (name: string): HeldSecret | undefined => held.get(name)

/**
 * `env` with each held secret's value where `env` has its placeholder: what reeval's own calls on
 * the host authenticate with (the agent's key, the judge's, a sandbox provider's, a workspace's
 * token), none of which the eval code reads.
 */
export function hostEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  if (!held.size) return env
  const out = { ...env }
  for (const [name, secret] of held) {
    if (isPlaceholder(env[name])) out[name] = secret.value
  }
  return out
}

const LOOPBACK = /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/

/**
 * A fetch for reeval's own calls with held secret `key`'s value: to `allowed` hosts only, over
 * https unless the host is this machine, through the runtime's own fetch as reeval started with it,
 * and never following a redirect, which could carry the value's header to another origin. A filled
 * secret's calls go to its filler, with the URL each was for, as the egress gateway sends the
 * agent's; any other goes to its URL.
 */
export function heldFetch(key: string, allowed: (host: string) => boolean): typeof fetch {
  const secret = held.get(key)
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (!allowed(url.hostname) || (url.protocol !== 'https:' && !LOOPBACK.test(url.hostname))) {
      return Promise.reject(
        new Error(
          `reeval refused to send ${key}, a ${secret?.mode ?? 'held'} key, to ${url.origin}.`,
        ),
      )
    }
    if (secret?.mode !== 'filled') return nativeFetch(input, { ...init, redirect: 'error' })
    const request = new Request(input, init)
    const headers = new Headers(request.headers)
    for (const [name, value] of Object.entries(fillHeaders(secret.filler, request.url))) {
      headers.set(name, value)
    }
    return nativeFetch(secret.filler.url, {
      method: request.method,
      headers,
      signal: request.signal,
      redirect: 'error',
      ...(request.body && { body: request.body, duplex: 'half' }),
    } as RequestInit)
  }
}

/**
 * `heldFetch` for held secret `key` when it's filled, for a call that otherwise takes the
 * runtime's fetch; undefined for any other, whose calls stay as they are.
 */
export const filledFetch = (
  key: string,
  allowed: (host: string) => boolean,
): typeof fetch | undefined =>
  held.get(key)?.mode === 'filled' ? heldFetch(key, allowed) : undefined

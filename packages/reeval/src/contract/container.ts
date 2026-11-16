// The container options `docker()` and `cloud()` share: who runs in it, its capabilities and its
// limits.
import { z } from 'zod'
import { got } from './shared.ts'

/** Docker's memory size: bytes, or a number with `b`, `k`, `m` or `g`. */
const MEMORY = /^\d+(\.\d+)?[bkmg]?$/i

/** The container's user, capabilities and limits, which `docker()` and `cloud()` share. */
export const containerFields = {
  root: z.boolean().optional(),
  capabilities: z.array(z.string().regex(/^(CAP_)?[A-Z_]+$/)).optional(),
  memory: z.union([z.string().regex(MEMORY), z.int().positive()]).optional(),
  swap: z.union([z.string().regex(MEMORY), z.int().nonnegative()]).optional(),
  cpus: z.number().positive().optional(),
  pids: z.int().positive().optional(),
}

/** The sentence for a container field the schema refused, in `fn`'s words, or undefined. */
export function containerFieldMessage(fn: string, key: string, v: unknown): string | undefined {
  switch (key) {
    case 'root':
      return `${fn}({ root }) is true or false (got ${got(v)})`
    case 'capabilities':
      return `${fn}({ capabilities }) takes Linux capability names, e.g. capabilities: ['NET_RAW'] (got ${got(v)})`
    case 'memory':
      return `${fn}({ memory }) takes a size such as '4g' or '512m', or bytes (got ${got(v)})`
    case 'swap':
      return `${fn}({ swap }) takes a size such as '2g' or '512m', bytes, or 0 for none (got ${got(v)})`
    case 'cpus':
      return `${fn}({ cpus }) takes a number of CPUs above zero, e.g. 1.5 (got ${typeof v === 'number' ? String(v) : got(v)})`
    case 'pids':
      return `${fn}({ pids }) takes a whole number of processes above zero (got ${got(v)})`
  }
  return undefined
}

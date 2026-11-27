import type { TrialRecord } from '../history/types.ts'
import type { JSONValue } from '../types.ts'

/** One observed name over one cell's trials: its values tallied, or its numbers summarized. Never gates. */
export type ObservedTally = {
  name: string
  /** The cell's key. */
  cell: string
  /** Trials that observed it. */
  trials: number
  /**
   * Each string, boolean or null value, and each such item of an array value once per trial,
   * by how many trials gave it, most first (ties in first-seen order); empty when none.
   */
  counts: Array<{ value: string; n: number }>
  /** Over the number values; null when none. */
  numbers: { median: number; min: number; max: number; n: number } | null
  /**
   * Values neither tallied nor summarized: objects, arrays with no scalar item, and values over
   * 4 KiB, which the record keeps in a file.
   */
  others: number
}

/** A scalar's tally label; numbers in an array count by their text. */
const label = (v: JSONValue) => (typeof v === 'string' ? v : JSON.stringify(v))
const scalar = (v: JSONValue) => v === null || typeof v !== 'object'

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
}

type Acc = {
  name: string
  cell: string
  counts: Map<string, number>
  nums: number[]
  others: number
  trials: number
}

/**
 * Each name and cell any trial observed it on, by name in first-observed order and then by
 * cell, tallied over that cell's trials.
 */
export function observedTallies(
  trials: ReadonlyArray<Pick<TrialRecord, 'cell' | 'observations'>>,
): ObservedTally[] {
  const byName = new Map<string, Map<string, Acc>>()
  for (const a of trials) {
    for (const { name, value, file } of a.observations ?? []) {
      const cells = byName.get(name) ?? new Map<string, Acc>()
      byName.set(name, cells)
      let t = cells.get(a.cell)
      if (!t) {
        t = { name, cell: a.cell, counts: new Map(), nums: [], others: 0, trials: 0 }
        cells.set(a.cell, t)
      }
      t.trials++
      const count = (v: string) => t.counts.set(v, (t.counts.get(v) ?? 0) + 1)
      if (file) t.others++
      else if (typeof value === 'number') t.nums.push(value)
      else if (scalar(value)) count(label(value))
      else if (Array.isArray(value) && value.some(scalar)) {
        for (const item of new Set(value.filter(scalar).map(label))) count(item)
      } else t.others++
    }
  }
  return [...byName.values()]
    .flatMap((cells) => [...cells.values()])
    .map((t) => {
      const nums = t.nums.toSorted((x, y) => x - y)
      return {
        name: t.name,
        cell: t.cell,
        trials: t.trials,
        counts: [...t.counts].map(([value, n]) => ({ value, n })).sort((x, y) => y.n - x.n),
        numbers: nums.length
          ? {
              median: median(nums),
              min: nums[0] as number,
              max: nums.at(-1) as number,
              n: nums.length,
            }
          : null,
        others: t.others,
      }
    })
}

/** Tallied values shown before `+N more`. */
const SHOWN = 5

const num = (n: number) => String(Math.round(n * 1000) / 1000)
/** On one line: a line break or a terminal escape in an observed string would break the table. */
const clipValue = (v: string) => {
  const flat = v.replace(/[\s\p{Cc}]+/gu, ' ').trim()
  return flat.length > 40 ? `${flat.slice(0, 39)}…` : flat
}

/** `drizzle 9 · prisma 3`, `median 4 · range 1–12 · 13 trials`, as the run output shows a tally. */
export function observedLine(t: ObservedTally): string {
  const parts = t.counts.slice(0, SHOWN).map((c) => `${clipValue(c.value)} ${c.n}`)
  const more = t.counts.length - SHOWN
  if (more > 0) parts.push(`+${more} more`)
  if (t.numbers) {
    const { median: m, min, max } = t.numbers
    parts.push(min === max ? `${num(m)}` : `median ${num(m)} · range ${num(min)}–${num(max)}`)
  }
  if (t.others)
    parts.push(`${t.others} ${t.others === 1 ? 'value' : 'values'} in reeval query trial_values`)
  const tallied = t.counts.reduce((sum, c) => sum + c.n, 0)
  const plain = !t.numbers && !t.others && tallied === t.trials
  return plain
    ? parts.join(' · ')
    : `${parts.join(' · ')} · ${t.trials} ${t.trials === 1 ? 'trial' : 'trials'}`
}

const sameTally = (a: ObservedTally, b: ObservedTally) =>
  a.trials === b.trials &&
  a.others === b.others &&
  JSON.stringify(a.counts) === JSON.stringify(b.counts) &&
  JSON.stringify(a.numbers) === JSON.stringify(b.numbers)

/**
 * How one name's tally on one cell moved from base to head, or null when it didn't:
 * `prisma 6 → 1 · drizzle 2 → 8` (each value whose count changed, head's most first),
 * `median 4 → 9`, or a side's whole line against `none` when only one side observed it.
 */
export function observedShift(
  base: ObservedTally | undefined,
  head: ObservedTally | undefined,
): string | null {
  if (!base && !head) return null
  if (!base || !head)
    return base ? `${observedLine(base)} → none` : `none → ${observedLine(head as ObservedTally)}`
  if (sameTally(base, head)) return null
  const before = new Map(base.counts.map((c) => [c.value, c.n]))
  const after = new Map(head.counts.map((c) => [c.value, c.n]))
  const values = [...new Set([...after.keys(), ...before.keys()])]
  const moved = values.filter((v) => (before.get(v) ?? 0) !== (after.get(v) ?? 0))
  const parts = moved
    .slice(0, SHOWN)
    .map((v) => `${clipValue(v)} ${before.get(v) ?? 0} → ${after.get(v) ?? 0}`)
  if (moved.length > SHOWN) parts.push(`+${moved.length - SHOWN} more`)
  const [b, h] = [base.numbers, head.numbers]
  if (b && h && b.median !== h.median) parts.push(`median ${num(b.median)} → ${num(h.median)}`)
  else if (b && h && (b.min !== h.min || b.max !== h.max)) {
    parts.push(`range ${num(b.min)}–${num(b.max)} → ${num(h.min)}–${num(h.max)}`)
  }
  if (base.trials !== head.trials) parts.push(`${base.trials} → ${head.trials} trials`)
  return parts.length ? parts.join(' · ') : null
}

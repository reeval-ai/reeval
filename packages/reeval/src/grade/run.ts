import { maskNumbers, notJson } from '../attempt/observe.ts'
import { canonicalJson } from '../eval-source.ts'
import { sha256 } from '../ids.ts'
import { redactSecrets, redactValue } from '../redact.ts'
import { clip, formatDuration } from '../text.ts'
import type { GradeFingerprint, GradeReads, GradeRecord, JSONValue } from '../types.ts'
import { type GradeInputs, graderContext, readData } from './context.ts'
import type { GradeRun, GraderDef } from './define.ts'

/** The most a grade may be, as JSON. */
const GRADE_LIMIT = 64 * 1024

type Ran = {
  grade?: JSONValue
  error?: string
  reads: GradeReads
  data?: string
  durationMs: number
}

const message = (error: unknown) =>
  clip(redactSecrets(error instanceof Error ? error.message : String(error)), 2000)

/** `grade`'s value as JSON data, masked as an observed value is, or why it isn't. */
function asGrade(value: unknown): { grade: JSONValue } | { error: string } {
  if (value === undefined) return { error: 'grade returned undefined. Return a JSON value.' }
  const problem = notJson(value, '', true)
  if (problem) return { error: `grade returned a value that isn't JSON: ${problem}` }
  let text: string
  try {
    text = JSON.stringify(value)
  } catch (error) {
    return { error: `grade returned a value that isn't JSON: ${message(error)}` }
  }
  if (text.length > GRADE_LIMIT) {
    return {
      error: `grade returned ${text.length} characters of JSON, over the ${GRADE_LIMIT} a grade may be`,
    }
  }
  return { grade: maskNumbers(redactValue(JSON.parse(text) as JSONValue)) }
}

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => reject(signal.reason)
    if (signal.aborted) return stop()
    signal.addEventListener('abort', stop, { once: true })
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', stop))
  })
}

async function runOnce(run: GradeRun, inputs: GradeInputs, signal: AbortSignal): Promise<Ran> {
  const started = performance.now()
  const timeout = AbortSignal.timeout(run.timeoutMs)
  const both = AbortSignal.any([signal, timeout])
  let reads: GradeReads = {}
  let data: string | undefined
  try {
    const read = await readData(run.data)
    data = read.digest
    const ctx = graderContext(inputs, run, read.data, both)
    const value = await abortable(
      Promise.resolve().then(() => run.grade(ctx.c)),
      both,
    ).finally(() => {
      reads = ctx.reads
    })
    return {
      ...asGrade(value),
      reads,
      ...(data ? { data } : {}),
      durationMs: performance.now() - started,
    }
  } catch (error) {
    const why = timeout.aborted
      ? `grade timed out after ${formatDuration(run.timeoutMs)}`
      : message(error)
    return { error: why, reads, ...(data ? { data } : {}), durationMs: performance.now() - started }
  }
}

function fingerprintOf(def: GraderDef, data: string | undefined): GradeFingerprint {
  const { run, builtin } = def
  const code = sha256(
    canonicalJson(
      builtin
        ? { name: def.name, builtin: builtin.kind, args: builtin.args }
        : { name: def.name, files: run.files, grade: run.gradeDigest },
    ),
  )
  const parts = {
    code,
    ...(builtin ? { version: builtin.version } : {}),
    ...(data ? { data } : {}),
    ...(run.revision !== undefined ? { revision: run.revision } : {}),
  }
  return { digest: sha256(canonicalJson(parts)), ...parts }
}

/** A member's score of its run's grade, or why it has none. */
function scoreOf(def: GraderDef, ran: Ran): { score: number | null; error?: string } {
  if (ran.error !== undefined || !('grade' in ran)) return { score: 0, error: ran.error }
  const grade = ran.grade as JSONValue
  if (def.score) {
    let score: unknown
    try {
      score = (def.score as (g: JSONValue) => unknown)(grade)
    } catch (error) {
      return { score: 0, error: `score threw: ${message(error)}` }
    }
    if (typeof score !== 'number' || !(score >= 0 && score <= 1)) {
      return { score: 0, error: `score returned ${String(score)}. A score is a number in [0, 1].` }
    }
    return { score }
  }
  if (typeof grade === 'boolean') return { score: grade ? 1 : 0 }
  if (def.required) {
    return {
      score: 0,
      error: `${def.name} is required but its grade has no score. Return a boolean, or give it score.`,
    }
  }
  return { score: null }
}

/**
 * Runs every grader at once, a `defineGraders` group's `grade` once for all its members, and
 * returns their grades in the order given.
 */
export async function runGraders(
  defs: readonly GraderDef[],
  inputs: GradeInputs,
  signal: AbortSignal,
): Promise<GradeRecord[]> {
  const runs = new Map<GradeRun, Promise<Ran>>()
  for (const def of defs) {
    if (!runs.has(def.run)) runs.set(def.run, runOnce(def.run, inputs, signal))
  }
  return Promise.all(
    defs.map(async (def): Promise<GradeRecord> => {
      const ran = await (runs.get(def.run) as Promise<Ran>)
      const { score, error } = scoreOf(def, ran)
      return {
        grader: def.name,
        kind: def.builtin ? 'builtin' : 'code',
        ...(def.run.names.length > 1 ? { group: def.run.names } : {}),
        ...('grade' in ran ? { grade: ran.grade } : {}),
        score,
        weight: def.weight,
        required: def.required,
        ...(error !== undefined ? { error } : {}),
        fingerprint: fingerprintOf(def, ran.data),
        ...(def.scoreDigest ? { scoreDigest: def.scoreDigest } : {}),
        reads: ran.reads,
        durationMs: Math.round(ran.durationMs),
      }
    }),
  )
}

/**
 * The attempt's score from its grades: the scored grades' mean, weighted, or 0 when a required
 * grader scored under 1. 1 when nothing scored.
 */
export function attemptScore(grades: readonly GradeRecord[]): number {
  if (grades.some((g) => g.required && (g.score === null || g.score < 1))) return 0
  const scored = grades.filter((g) => g.score !== null && g.weight > 0)
  const total = scored.reduce((sum, g) => sum + g.weight, 0)
  if (!total) return 1
  return scored.reduce((sum, g) => sum + g.weight * (g.score as number), 0) / total
}

/** Why an attempt that scored under 1 fails: its score and each grader that cost it. */
export function scoreFailure(score: number, grades: readonly GradeRecord[]): string {
  const cost = grades.filter(
    (g) =>
      g.error !== undefined || (g.score !== null && g.score < 1 && (g.weight > 0 || g.required)),
  )
  const why = cost.map((g) =>
    g.error !== undefined
      ? `${g.grader} errored: ${g.error.split('\n')[0]}`
      : `${g.grader}${g.required ? ' (required)' : ''} scored ${g.score?.toFixed(2)}`,
  )
  return `score ${score.toFixed(2)} below 1: ${why.join('; ')}`
}

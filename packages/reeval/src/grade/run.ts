import { AgentError } from '@reeval/agents'
import { maskNumbers, notJson } from '../attempt/observe.ts'
import { canonicalJson } from '../eval-source.ts'
import { sha256 } from '../ids.ts'
import { redactSecrets, redactValue } from '../redact.ts'
import { InfraError } from '../sandbox/types.ts'
import { clip, formatDuration } from '../text.ts'
import type { GradeFingerprint, GradeReads, GradeRecord, JSONValue, JudgeGrade } from '../types.ts'
import { copyFiles, GradeError, type GradeInputs, graderContext, readData } from './context.ts'
import type { CodeRun, GradeRun, GraderDef } from './define.ts'
import { type JudgeRun, judgeCode, readsOf, runJudgeGrader } from './judge.ts'
import type { StartedSandbox } from './sandbox.ts'

/** The most a grade may be, as JSON. */
const GRADE_LIMIT = 64 * 1024

type Ran = {
  grade?: JSONValue
  error?: string
  reads: GradeReads
  data?: string
  image?: string
  /** A judge grader's calls and reference, its reference's digest and its models' names. */
  judge?: JudgeGrade
  reference?: string
  models?: string[]
  durationMs: number
}

/** Why a grader's sandbox didn't start or take its files, which no grade records. */
class SandboxFailure extends Error {
  readonly infra: Error
  constructor(infra: Error) {
    super(infra.message)
    this.infra = infra
  }
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
  return run.kind === 'judge' ? runJudge(run, inputs, signal) : runCode(run, inputs, signal)
}

async function runJudge(run: JudgeRun, inputs: GradeInputs, signal: AbortSignal): Promise<Ran> {
  const started = performance.now()
  const timeout = AbortSignal.timeout(run.timeoutMs)
  const reads = readsOf()
  try {
    const { error, ...ran } = await abortable(
      runJudgeGrader(run, inputs, reads, AbortSignal.any([signal, timeout])),
      AbortSignal.any([signal, timeout]),
    )
    return {
      ...ran,
      ...(error !== undefined ? { error: message(error) } : {}),
      reads: reads.reads(),
      durationMs: performance.now() - started,
    }
  } catch (error) {
    const why = timeout.aborted
      ? `judge timed out after ${formatDuration(run.timeoutMs)}`
      : message(error)
    return { error: why, reads: reads.reads(), durationMs: performance.now() - started }
  }
}

async function runCode(run: CodeRun, inputs: GradeInputs, signal: AbortSignal): Promise<Ran> {
  const startedAt = performance.now()
  let timeout: AbortSignal | undefined
  const timed = () => {
    timeout ??= AbortSignal.timeout(run.timeoutMs)
    return AbortSignal.any([signal, timeout])
  }
  let reads: GradeReads = {}
  let data: string | undefined
  let box: StartedSandbox | undefined
  const ended = () => ({
    reads,
    ...(data ? { data } : {}),
    ...(box ? { image: box.image } : {}),
    durationMs: performance.now() - startedAt,
  })
  try {
    const read = await readData(run.data)
    data = read.digest
    const sandbox = run.env && (await startSandbox(run, inputs, signal, timed))
    box = sandbox?.started
    const both = timed()
    const ctx = graderContext(
      inputs,
      run,
      read.data,
      both,
      sandbox && {
        box: sandbox.started.box,
        copied: sandbox.copied,
      },
    )
    const value = await abortable(
      Promise.resolve().then(() => run.grade(ctx.c)),
      both,
    ).finally(() => {
      reads = ctx.reads
    })
    return { ...asGrade(value), ...ended() }
  } catch (error) {
    if (error instanceof SandboxFailure) throw error.infra
    const why = timeout?.aborted
      ? `grade timed out after ${formatDuration(run.timeoutMs)}`
      : message(error)
    return { error: why, ...ended() }
  } finally {
    await box?.close().catch(() => {})
  }
}

/**
 * `run`'s `env` sandbox with its files copied in. Failing to start it or copy them is the
 * attempt's infra error, thrown as a `SandboxFailure`; a grader with files and no kept workspace
 * is its own error. `timed()` is the signal, with the grader's timeout running, once its slot is
 * held.
 */
async function startSandbox(
  run: CodeRun,
  inputs: GradeInputs,
  signal: AbortSignal,
  timed: () => AbortSignal,
) {
  const env = run.env as NonNullable<CodeRun['env']>
  if (!inputs.sandboxes) throw new GradeError('graders with env run only in reeval run')
  let started: StartedSandbox | undefined
  let held = signal
  try {
    started = await inputs.sandboxes(env, run.timeoutMs, signal, () => {
      held = timed()
      return held
    })
    return { started, copied: await copyFiles(inputs, run, started.box, timed()) }
  } catch (error) {
    await started?.close().catch(() => {})
    if (error instanceof GradeError || held.aborted) throw error
    throw new SandboxFailure(
      error instanceof AgentError
        ? error
        : new InfraError(`A grader's sandbox failed to start: ${message(error)}`),
    )
  }
}

function fingerprintOf(def: GraderDef, ran: Ran): GradeFingerprint {
  const { run, builtin } = def
  const { data, reference } = ran
  const code =
    run.kind === 'judge'
      ? judgeCode(run, def.name, ran.models ?? [])
      : sha256(
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
    ...(ran.image ? { image: ran.image } : {}),
    ...(reference ? { reference } : {}),
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
 * returns their grades in the order given. Throws the infra error of a grader's sandbox that
 * didn't start, once every grader has settled.
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
  const settled = await Promise.allSettled(runs.values())
  const failed = settled.find((s) => s.status === 'rejected')
  if (failed) throw failed.reason
  return Promise.all(
    defs.map(async (def): Promise<GradeRecord> => {
      const ran = await (runs.get(def.run) as Promise<Ran>)
      const { score, error } = scoreOf(def, ran)
      return {
        grader: def.name,
        kind: def.builtin ? 'builtin' : def.run.kind,
        ...(def.run.names.length > 1 ? { group: def.run.names } : {}),
        ...('grade' in ran ? { grade: ran.grade } : {}),
        score,
        weight: def.weight,
        required: def.required,
        ...(error !== undefined ? { error } : {}),
        fingerprint: fingerprintOf(def, ran),
        ...(def.scoreDigest ? { scoreDigest: def.scoreDigest } : {}),
        reads: ran.reads,
        ...(ran.judge ? { judge: ran.judge } : {}),
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

/** Why an attempt that scored under its threshold fails: its score and each grader that cost it. */
export function scoreFailure(
  score: number,
  threshold: number,
  grades: readonly GradeRecord[],
): string {
  const cost = grades.filter(
    (g) =>
      g.error !== undefined || (g.score !== null && g.score < 1 && (g.weight > 0 || g.required)),
  )
  const why = cost.map((g) =>
    g.error !== undefined
      ? `${g.grader} errored: ${g.error.split('\n')[0]}`
      : `${g.grader}${g.required ? ' (required)' : ''} scored ${g.score?.toFixed(2)}`,
  )
  return `score ${score.toFixed(2)} below ${threshold}: ${why.join('; ')}`
}

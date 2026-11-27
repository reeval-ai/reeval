import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { AgentError, statusCause } from '@reeval/agents'
import { debugLog } from '../debug/trial.ts'
import { allowedHosts, isDirect } from '../egress.ts'
import { isTimeout } from '../errors.ts'
import { isEvalError } from '../eval-error.ts'
import { expectedBlockedFor } from '../harness/agents.ts'
import { ProviderStopError } from '../harness/provider-stop.ts'
import { OBSERVATION_INLINE } from '../history/types.ts'
import { recordFileName, sha256, trialKey } from '../ids.ts'
import { modelCallEvents } from '../model-calls.ts'
import { sandboxProvider } from '../options.ts'
import { redactJson, redactJsonText, redactSecrets, redactSplitSecrets } from '../redact.ts'
import { InfraError, RunStopped, type Sandbox } from '../sandbox/index.ts'
import { PrepareError } from '../sandbox/provider.ts'
import { capMiddle, clip } from '../text.ts'
import type {
  ErrorKind,
  EvalMeta,
  EvalRecord,
  JSONValue,
  TrajectoryEvent,
  TrialFailure,
} from '../types.ts'
import { resourcesLine } from '../view/resources.ts'
import { messageLine } from '../view/suite.ts'
import { inferDurations, sumSplits, timeSplit } from '../view/timeline.ts'
import { turnErrorKind } from '../view/turn-error.ts'
import { writeCaptureSidecars } from './capture.ts'
import { maskedJson } from './observe.ts'
import type { Trial } from './state.ts'

/**
 * An unhandled mid-turn `status === 'error'` (body never read `turn.status`) becomes an
 * infra error so crashed trials leave the counted pass/fail denominator.
 */
export function reclassifyTurnErrors(a: Trial): void {
  const { record } = a
  if (record.outcome !== 'pass' && record.outcome !== 'fail') return
  const index = record.turns.findIndex((t) => t.status === 'error')
  if (index < 0) return
  // Persist whether the body inspected status, so older-record viewers can tell.
  if (a.turnStatusRead) {
    record.turnStatusRead = true
    return
  }
  record.turnStatusRead = false
  const turn = record.turns[index]
  if (!turn) return
  const errEvent = turn.trajectory.find((e) => e.type === 'error')
  const errText = errEvent && errEvent.type === 'error' ? errEvent.message : undefined
  const kind = turnErrorKind(errText)
  const detail = messageLine(errText ?? 'unknown error')
  record.outcome = 'infra_error'
  record.error = {
    kind: 'infra',
    message: `Turn ${index} ended with an error: ${detail}`,
    turn: { index, kind },
  }
}

function classify(error: unknown, signal: AbortSignal): { kind: ErrorKind; message: string } {
  const message = error instanceof Error ? error.message : String(error)
  if (signal.aborted) {
    return isTimeout(signal.reason)
      ? { kind: 'timeout', message: 'The eval timed out' }
      : { kind: 'aborted', message: 'The run was canceled' }
  }
  if (error instanceof RunStopped) return { kind: 'aborted', message }
  if (error instanceof AgentError) return { kind: 'infra', message }
  return { kind: 'assertion', message }
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** The statuses that say the provider, not the agent or its config, failed a call. */
const outageStatus = (s: number) => s === 402 || s === 408 || s === 429 || s >= 500

/**
 * A timeout spent in a turn whose every answered model call the provider failed (a payment, rate
 * or capacity limit, a 5xx) becomes an infra error: a CLI that keeps retrying an outage spends the
 * eval's time, not the agent. After teardown, so a stream the timeout cut has ended and counts as
 * answered. A turn with no answered call says nothing, since one long streamed call can be the
 * whole turn, and nor does one that got a 4xx the provider sends for a bad request or key.
 */
export function reclassifyTimeout(a: Trial): void {
  const { record, turnCalls } = a
  if (record.error?.kind !== 'timeout' || !turnCalls) return
  const statuses = (a.sandbox?.modelCalls?.() ?? [])
    .slice(turnCalls.before)
    .flatMap((c) => (c.status === null ? [] : [c.status]))
  if (!statuses.length || !statuses.every(outageStatus)) return
  const counts = new Map<number, number>()
  for (const s of statuses) counts.set(s, (counts.get(s) ?? 0) + 1)
  const http = [...counts].map(([s, n]) => `HTTP ${s}${n > 1 ? ` ×${n}` : ''}`).join(', ')
  const last = statuses.at(-1) as number
  const cause = statusCause(last)
  record.outcome = 'infra_error'
  record.error = {
    kind: 'infra',
    message: `The eval timed out while the model provider failed every model call in turn ${turnCalls.turn} (${http})`,
    turn: { index: turnCalls.turn, kind: 'transport' },
    ...(cause && { provider: { cause, status: last } }),
  }
}

/** Why the trial failed, into the record: the eval's own timeout, a cancel, an infra error, or the task's. */
export function recordFailure(a: Trial, error: unknown, timedOut: boolean): void {
  const { record } = a
  record.error = timedOut
    ? { kind: 'timeout', message: 'The eval timed out' }
    : classify(error, a.signal)
  record.error.message = capMiddle(redactSecrets(record.error.message))
  if (error instanceof PrepareError && !timedOut) {
    const { class: kind, stage, ref, cause, log, setBy } = error.failure
    record.error.prepare = { class: kind, stage, ref, cause, log, setBy: setBy ?? [] }
  }
  if (error instanceof ProviderStopError && !timedOut) record.error.provider = { ...error.stop }
  record.outcome = record.error.kind === 'infra' ? 'infra_error' : 'fail'
}

const withoutStack = ({ stack: _, ...failure }: TrialFailure) => failure

const REASON_MAX = 200
const STACK_MAX = 8 * 1024

/**
 * A thrown message on one line: each line break, and the space around it, folded to a space, and
 * every escape sequence and other control character dropped, so it can't redraw a terminal.
 */
const oneLine = (text: string) =>
  stripVTControlCharacters(text)
    .replace(/\s*[\r\n\u2028\u2029]+\s*/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .trim()

/** How many `cause`s deep a recorded stack follows. */
const CAUSE_DEPTH = 5

/** `error`'s stack, then each of its `cause`s' as `Caused by: …`, as Python's traceback chains them. */
function chainedStack(error: Error): string | undefined {
  let stack = error.stack
  let cause: unknown = error.cause
  for (let depth = 0; cause !== undefined && depth < CAUSE_DEPTH; depth++) {
    const said =
      cause instanceof Error ? (cause.stack ?? `${cause.name}: ${cause.message}`) : String(cause)
    stack = `${stack ?? `${error.name}: ${error.message}`}\nCaused by: ${said}`
    cause = cause instanceof Error ? cause.cause : undefined
  }
  return stack
}

/** An `EvalError`'s meta, masked; past `OBSERVATION_INLINE` of JSON, a marker saying how big it was. */
function cappedMeta(meta: { [key: string]: JSONValue }): { [key: string]: JSONValue } {
  const masked = maskedJson(meta) as { [key: string]: JSONValue }
  const bytes = Buffer.byteLength(JSON.stringify(masked))
  return bytes > OBSERVATION_INLINE ? { truncated: true, bytes } : masked
}

/** JavaScript's own `EvalError` given reeval's options: it stringifies them. */
const UNIMPORTED =
  "EvalError isn't reeval's: import { EvalError } from 'reeval' to record its reason and meta"

/** What the task threw, into the record, when it failed the trial as itself. */
export function recordTaskFailure(a: Trial, error: unknown, root: string): void {
  const { record } = a
  if (record.error?.kind !== 'assertion') return
  const message = messageOf(error)
  const evalError = isEvalError(error)
  const name = error instanceof Error ? error.name : undefined
  const unimported =
    !evalError && error instanceof globalThis.EvalError && error.message === '[object Object]'
  const said = unimported ? UNIMPORTED : oneLine(evalError ? (error.reason ?? message) : message)
  const stack = error instanceof Error ? chainedStack(error) : undefined
  record.failure = {
    kind: 'task',
    reason: clip(redactSecrets(said || name || 'the task threw'), REASON_MAX),
    ...(evalError && error.meta ? { meta: cappedMeta(error.meta) } : {}),
    ...(!evalError && name ? { name } : {}),
    turn: a.turns.length,
    ...(stack
      ? { stack: capMiddle(redactSecrets(stack.replaceAll(`${root}${sep}`, '')), STACK_MAX) }
      : {}),
  }
  if (evalError) record.error.message = record.failure.reason
}

/** What the sandbox gave the trial and what it used, into the record, before the sandbox goes. */
export async function recordResources(a: Trial): Promise<void> {
  const resources = await a.meter?.stop({ gone: a.signal.aborted }).catch(() => undefined)
  if (!resources) return
  a.record.resources = resources
  debugLog('teardown', `resources ${resourcesLine(resources)}`)
}

/**
 * A process the kernel killed at the sandbox's memory limit makes the trial an infra error,
 * whatever its checks said: the limit, not the agent, decided it. Returns the error to fail it with.
 */
export async function recordOom(
  a: Trial,
  sandbox: Sandbox | undefined,
): Promise<InfraError | undefined> {
  const oom = await sandbox?.oomKills?.().catch(() => null)
  const at = oom && `the ${oom.limit} limit${oom.swap ? ` (+${oom.swap} swap)` : ''}`
  if (oom) debugLog('teardown', `oom_kill ${oom.kills} at ${at}`)
  if (!oom?.kills) return undefined
  const processes = oom.kills === 1 ? '1 process' : `${oom.kills} processes`
  const message = `out of memory: ${processes} killed at ${at}; raise ${sandboxProvider(a.spec.sandbox)}({ memory })`
  a.record.error = { kind: 'infra', message, resource: { cause: 'oom', kills: oom.kills } }
  a.record.outcome = 'infra_error'
  return new InfraError(message)
}

/** The gateway tags entries with the phase it was switched to, which is always one of the trial's. */
const phased = <T extends { phase?: string }>(entry: T): T & { phase?: 'setup' | 'agent' } =>
  entry as T & { phase?: 'setup' | 'agent' }

/**
 * The trial's egress policy and, when its sandbox records it, what it contacted and was refused.
 * Refused hosts the harness always tries (in a session like this one) are `expectedBlocked`,
 * summarized in one `-v` line. Names that didn't resolve are `unresolved`, never `blocked`.
 */
export function recordEgress(a: Trial, sandbox: Sandbox | undefined): void {
  const traffic = sandbox?.traffic?.()
  const expected = expectedBlockedFor(
    a.spec.harness,
    (a.env?.plugins.length ?? 0) > 0,
    a.spec.vertex,
  )
  const refused = traffic?.blocked ?? []
  // The harness runs only in the agent phase, so a refusal setup met is never its own.
  const isExpected = (h: { host: string; phase?: string }) =>
    h.phase !== 'setup' && !!expected?.hosts.includes(h.host)
  const expectedBlocked = refused.filter(isExpected)
  const { setup } = a.spec.egress
  const direct = isDirect(a.spec.egress.policy) || (!!setup && isDirect(setup.policy))
  a.record.egress = {
    policy: a.spec.egress.policy,
    allowed: allowedHosts(a.spec.egress),
    ...(setup ? { setup: { policy: setup.policy, allowed: allowedHosts(setup) } } : {}),
    recorded: !!traffic,
    ...(traffic && direct ? { partial: true as const } : {}),
    contacted: (traffic?.contacted ?? []).map(phased),
    blocked: refused.filter((h) => !isExpected(h)).map(phased),
    expectedBlocked: expectedBlocked.map(phased),
    unresolved: (traffic?.unresolved ?? []).map(phased),
  }
  if (expected && expectedBlocked.length) {
    const hosts = expectedBlocked.map((h) => `${h.host}:${h.port} ×${h.connections}`).join(', ')
    debugLog('gateway', `expected blocks, not logged per request: ${hosts} · ${expected.why}`)
  }
  a.record.servedModels = sandbox?.servedModels?.() ?? null
  const asked = sandbox?.askedModels?.() ?? []
  if (asked.length) a.record.askedModels = asked
  const upstreams = sandbox?.upstreams?.() ?? []
  if (upstreams.length) a.record.upstreams = upstreams
  const cost = sandbox?.reportedCostUsd?.()
  if (cost !== undefined) a.record.reportedCostUsd = cost
  const strays = sandbox?.secretWarnings?.() ?? []
  if (strays.length) a.record.secretWarnings = strays
}

/**
 * Each turn's model calls and inferred tool durations in its trajectory, and where its time
 * went. After teardown, so a stream that outlived its turn (Cursor's) has ended.
 */
export function recordTimeline(a: Trial, sandbox: Sandbox | undefined): void {
  const calls = sandbox?.modelCalls?.() ?? []
  for (const turn of a.record.turns) {
    const events = inferDurations(
      [
        ...turn.trajectory,
        ...modelCallEvents(calls, {
          startedAt: Date.parse(turn.startedAt),
          durationMs: turn.durationMs,
          model: turn.model,
          steps: a.turnSteps.get(turn) ?? [],
        }),
      ].sort((x, y) => x.atMs - y.atMs),
      turn.durationMs,
    )
    turn.trajectory = events
    turn.timeSplit = timeSplit(events, turn.durationMs)
  }
  const split = sumSplits(a.record.turns.map((t) => t.timeSplit))
  if (split) a.record.timeSplit = split
}

/**
 * The record as its staging file holds it: redacted, with a secret split across a turn's raw
 * stream parts masked first, since masking each part on its own leaves pieces of it to rebuild.
 */
export function stagedRecordJson(record: EvalRecord): string {
  const turns = record.turns.map((turn) =>
    turn.raw
      ? {
          ...turn,
          raw: redactSplitSecrets(turn.raw.map((part) => JSON.stringify(part))).map(
            (line) => JSON.parse(line) as unknown,
          ),
        }
      : turn,
  )
  return redactJson({ ...record, turns }, 2)
}

/**
 * The record with each observed value over `OBSERVATION_INLINE` written to `dir` as its masked
 * JSON and named by `file` (relative to `dir`) in its place, so the record stays small.
 */
async function stageObservations(record: EvalRecord, dir: string): Promise<EvalRecord> {
  if (!record.observations?.length) return record
  const observations = []
  for (const [i, o] of record.observations.entries()) {
    const json = JSON.stringify(o.value)
    if (Buffer.byteLength(json) <= OBSERVATION_INLINE) {
      observations.push(o)
      continue
    }
    const bytes = Buffer.from(redactJsonText(json))
    const path = `${i + 1}.json`
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, path), bytes)
    observations.push({
      ...o,
      value: null,
      file: { path, sha256: sha256(bytes), bytes: bytes.length },
    })
  }
  return { ...record, observations }
}

/** Writes the trial's record, redacted, and returns what the runner reports. */
export async function writeRecord(a: Trial, stagingDir: string, id: string): Promise<EvalMeta> {
  const { record, spec } = a
  const recordPath = join(stagingDir, 'evals', recordFileName(trialKey(id, spec.cell.key, spec.n)))
  await mkdir(join(stagingDir, 'evals'), { recursive: true })
  await writeCaptureSidecars(
    stagingDir,
    recordFileName(trialKey(id, spec.cell.key, spec.n)),
    new Map([...a.artifactBlobs, ...a.stepBlobs]),
    a.capturePages,
  )
  const staged = await stageObservations(record, recordPath.replace(/\.json$/, '.observations'))
  // Replaced whole: reeval studio reads it while the run goes on.
  const tmp = `${recordPath}.${process.pid}.tmp`
  await writeFile(tmp, stagedRecordJson(staged))
  await rename(tmp, recordPath)
  return {
    outcome: record.outcome,
    errorKind: record.error?.kind ?? null,
    ...(record.failure ? { failure: withoutStack(record.failure) } : {}),
    judgements: [],
    turnErrors: turnErrors(record.turns.map((t) => t.trajectory)),
    ...(record.error?.prepare
      ? { prepare: { ref: record.error.prepare.ref, stage: record.error.prepare.stage } }
      : {}),
  }
}

/** `turn N error: <message>` for each turn with an error event. */
export function turnErrors(trajectories: TrajectoryEvent[][]): string[] {
  return trajectories.flatMap((events, i) => {
    const found = events.find((e) => e.type === 'error')
    return found?.type === 'error'
      ? [`turn ${i + 1} error: ${clip(redactSecrets(found.message.trim()), 500)}`]
      : []
  })
}

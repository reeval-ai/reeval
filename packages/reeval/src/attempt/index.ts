// One attempt's lifecycle, a phase per module: resolve the environment (environment.ts), start
// the session (session.ts), run turns (turns.ts), run checks and the judge (checks.ts, judge.ts),
// tear down, and write the record (record.ts). They share one `Attempt` (state.ts).
import { AttemptDebug, withDebug } from '../debug/attempt.ts'
import { attemptDebugDir } from '../debug/files.ts'
import { getRunContext, type TestHandle } from '../engine/runtime.ts'
import { TimeoutError } from '../errors.ts'
import { checkGraderImages } from '../grade/sandbox.ts'
import { attemptId, attemptKey, evalId, evalSlug, relativeFile } from '../ids.ts'
import { redactSecrets } from '../redact.ts'
import { InfraError } from '../sandbox/types.ts'
import { clip, formatDuration } from '../text.ts'
import {
  type AgentAttempt,
  agentSpans,
  finishedTurnSpans,
  openAgentSpan,
} from '../trace/agent-spans.ts'
import { otelEnv, otlpProtocol } from '../trace/otlp.ts'
import {
  attemptSpan,
  emitAgentSpans,
  openAgentTrace,
  openSpan,
  withAttemptSpan,
} from '../trace/spans.ts'
import type { AttemptContext, EvalFn, EvalRecord } from '../types.ts'
import { assertionRecords, checkFailure, linkJudgmentAssertions } from './assertions.ts'
import { capturePage, serveCommand } from './capture.ts'
import { createChecks } from './checks.ts'
import { contextTaker } from './context.ts'
import { tracePlan } from './debug.ts'
import { decider, partOf, stateBuilder } from './decide.ts'
import { prepareEnvironment } from './environment.ts'
import { type Grading, gradeAttempt } from './grade.ts'
import { judgeCaller } from './judge.ts'
import { observer } from './observe.ts'
import {
  attemptError,
  judgeErrorsMessage,
  reclassifyTimeout,
  reclassifyTurnErrors,
  recordEgress,
  recordFailure,
  recordOom,
  recordResources,
  recordTaskFailure,
  recordTimeline,
  writeRecord,
} from './record.ts'
import { startSession } from './session.ts'
import { snapshotSidecar, takeSnapshot } from './snapshot.ts'
import { type AttemptSpec, bindAttemptContext, createAttempt, evalTimer } from './state.ts'
import { turnSender } from './turns.ts'
import { keepWorkspace, workspaceSidecar } from './workspace.ts'

export type { Grading } from './grade.ts'
export type { AttemptSpec } from './state.ts'
export { setupAllowance } from './state.ts'

const TRACE_BUFFER_DEFAULT = 8 * 2 ** 20

export async function runAttempt(
  spec: AttemptSpec,
  fn: EvalFn,
  handle: TestHandle,
  grading?: Grading,
): Promise<void> {
  const ctx = getRunContext()
  const { config, runId } = ctx
  const verbosity = ctx.verbosity ?? 0
  const id = evalId(relativeFile(config.root, handle.file), [...spec.groups, spec.name])
  const debug = new AttemptDebug({
    dir: attemptDebugDir(config.root, runId, id, spec.cell.key, spec.n),
    verbosity,
    traceLimit: config.debug?.traceBufferBytes ?? TRACE_BUFFER_DEFAULT,
    ...(verbosity > 0 ? { emit: handle.debug } : {}),
  })
  const span = openSpan('attempt', {
    'reeval.eval.id': id,
    'reeval.attempt.key': attemptKey(id, spec.cell.key, spec.n),
    'reeval.cell': spec.cell.key,
    'reeval.attempt.n': spec.n,
  })
  let error: unknown
  try {
    return await withDebug(debug, () =>
      withAttemptSpan(span, () => attemptBody(spec, fn, handle, id, debug, grading)),
    )
  } catch (thrown) {
    error = thrown
    throw thrown
  } finally {
    span.end(error)
  }
}

async function attemptBody(
  spec: AttemptSpec,
  fn: EvalFn,
  { signal: testSignal, setMeta, progress, unawaited, expectError, assertions }: TestHandle,
  id: string,
  debug: AttemptDebug,
  grading: Grading | undefined,
): Promise<void> {
  const ctx = getRunContext()
  const { runId, stagingDir, config } = ctx
  tracePlan(debug, spec, ctx)
  const key = attemptKey(id, spec.cell.key, spec.n)
  let timer: AbortSignal | undefined
  let clock: ReturnType<typeof evalTimer> | undefined
  // The environment and image are prepared on the test's signal; the eval timer starts after,
  // and pauses while the sandbox starts.
  const a = createAttempt(
    spec,
    testSignal,
    progress,
    async (a, who) => {
      debug.log('container', `starting the sandbox and session for ${who}`)
      clock?.pause()
      try {
        return await a.timed('setupMs', () => startSession(a, runId, key), 'sandbox')
      } finally {
        clock?.resume()
      }
    },
    snapshotSidecar(stagingDir, key),
  )
  // The running turn's CLI stores its usage in the sandbox: read it before the sandbox goes.
  const destroy = () =>
    void Promise.resolve(a.session?.salvage?.())
      .catch(() => {})
      .finally(() => a.sandbox?.destroy())
  testSignal.addEventListener('abort', destroy, { once: true })

  const takeContext = contextTaker(a)
  const { exec, readFile, writeFile } = createChecks(a)
  const tracing = !!otlpProtocol(otelEnv(process.env, ''), 'traces')
  const agent = (): AgentAttempt => ({
    runId,
    evalId: id,
    key,
    cell: spec.cell.key,
    n: spec.n,
    harness: spec.harness,
    record: a.record,
    ...(attemptSpan() && { attemptSpanId: attemptSpan()?.spanId }),
  })
  const sentTurns = new Set<number>()
  const onTurnEnd = (i: number) => {
    try {
      const spans = finishedTurnSpans(agent(), i)
      if (!spans.length) return
      sentTurns.add(i)
      emitAgentSpans(spans)
    } catch {}
  }
  if (tracing) openAgentTrace(openAgentSpan(agent()))

  const c: AttemptContext = {
    get signal() {
      return a.signal
    },
    turns: a.turns,
    exec,
    readFile,
    writeFile,
    observe: observer(a),
    serve: (command, port) => serveCommand(a, command, port),
    capture: (target, options) => capturePage(a, target, options),
    attempt: { id: attemptId(spec.cell.key, spec.n), cell: spec.cell, n: spec.n },
    send: turnSender(a, takeContext, { exec, readFile }, tracing ? onTurnEnd : undefined),
    judge: judgeCaller(a, readFile),
    decide: decider(a),
    state: stateBuilder(a, readFile),
    part: partOf(a),
  }
  bindAttemptContext(c, a)

  const timedOut = () => !!timer?.aborted && !testSignal.aborted
  let failure: { error: unknown } | undefined
  let oom: Error | undefined
  let taskThrew: { error: unknown } | undefined
  try {
    a.report({ kind: 'sandbox' })
    const where = `${id} [${attemptId(spec.cell.key, spec.n)}]`
    await a.timed('setupMs', () => prepareEnvironment(a, config.root, runId, where, testSignal))
    if (grading?.graders.some((g) => g.run.kind === 'code' && g.run.env)) {
      await checkGraderImages(grading.graders.map((g) => g.run))
    }
    clock = evalTimer(spec.timeoutMs)
    timer = clock.signal
    a.signal = AbortSignal.any([testSignal, timer])
    timer.addEventListener('abort', destroy, { once: true })
    await fn(c).catch((error: unknown) => {
      if (a.infraFailure) throw a.infraFailure.error
      taskThrew = { error }
      throw error
    })
    // A body that ignores the signal can still return normally after a timeout or cancel.
    a.signal.throwIfAborted()
    const missed = (await unawaited()) ?? checkFailure(assertions()) ?? expectError()
    // A start or decision that failed under a caught call or an `expect` still fails the attempt as itself.
    if (a.infraFailure) throw a.infraFailure.error
    if (missed) throw missed
    const judgeErrors = judgeErrorsMessage(a)
    if (judgeErrors) {
      a.judgeThrown.add(judgeErrors)
      throw new Error(judgeErrors)
    }
  } catch (thrown) {
    const error = attemptError(a, thrown, assertions())
    recordFailure(a, error, timedOut(), assertions())
    if (taskThrew?.error === error) recordTaskFailure(a, error, assertions(), config.root)
    failure = {
      error: timedOut()
        ? new TimeoutError(`Eval timed out after ${spec.timeoutMs / 1000}s`)
        : error,
    }
  } finally {
    // Checks the eval didn't await still use the sandbox: let them finish before teardown.
    if (!a.signal.aborted) await unawaited().catch(() => {})
    clock?.clear()
    await a.endStarts()
    for (const bg of a.backgrounds) await bg.kill().catch(() => {})
    await recordResources(a)
    const { sandbox } = a
    if (sandbox && !a.signal.aborted) await takeContext(sandbox, AbortSignal.timeout(30_000))
    if (sandbox) a.report({ kind: 'cleanup' })
    testSignal.removeEventListener('abort', destroy)
    const teardown = performance.now()
    await a.session?.close().catch(() => {})
    if (a.session) debug.log('teardown', 'harness session closed')
    recordEgress(a, sandbox)
    // A timeout or cancel has already removed the container, so there's nothing left to read.
    oom = a.signal.aborted ? undefined : await recordOom(a, sandbox)
    if (sandbox && spec.snapshot.when && !a.signal.aborted) {
      await takeSnapshot(a, sandbox, 'final', 'teardown')
    }
    // Without a session, the workspace never had the git index the kept files are listed from.
    if (sandbox && a.session && !a.signal.aborted) {
      await keepWorkspace(a, sandbox, workspaceSidecar(stagingDir, key))
    }
    await sandbox?.destroy()
    recordTimeline(a, sandbox)
    reclassifyTimeout(a)
    if (sandbox) {
      debug.log(
        'teardown',
        `sandbox destroyed (${formatDuration(performance.now() - teardown)} for teardown)`,
      )
    }
    const { record } = a
    const checked = assertionRecords(assertions())
    if (checked.length) record.assertions = checked
    linkJudgmentAssertions(record.judgements ?? [], checked)
    for (const x of checked) {
      const why = x.message ? ` · ${clip(redactSecrets(x.message.split('\n')[0] ?? ''), 160)}` : ''
      const mark = x.status === 'pass' || x.status === 'not_applicable' ? '✓' : '✗'
      debug.log('check', `assert ${mark} ${x.label} (${x.matcher}, ${x.status})${why}`)
    }
    reclassifyTurnErrors(a)
    // A turn's error, an OOM kill or a provider outage the timeout hid is why it ended instead.
    if (record.error?.kind !== 'assertion') delete record.failure
    // Graders read what the task left, so none runs after it threw, timed out or was canceled.
    if (grading?.graders.length && record.outcome === 'pass' && !failure && !oom) {
      const low = await gradeAttempt(
        a,
        grading,
        key,
        workspaceSidecar(stagingDir, key),
        testSignal,
      ).catch(
        (error: unknown) =>
          new InfraError(
            `Grading failed: ${error instanceof Error ? error.message : String(error)}`,
          ),
      )
      if (testSignal.aborted) {
        recordFailure(a, testSignal.reason, false, assertions())
        failure = { error: testSignal.reason }
      } else if (low) {
        recordFailure(a, low, false, assertions())
        failure = { error: low }
      }
    }
    const score = record.score ?? scoreOf(record)
    if (score !== undefined) record.score = score
    const error = record.error ? ` · ${record.error.kind}: ${record.error.message}` : ''
    debug.log('teardown', `outcome ${record.outcome}${error}`)
    const rel = (path: string) => relativeFile(config.root, path) || '.'
    const scratch = `.reeval/runs/${runId}`
    debug.log(
      'teardown',
      `record ${scratch}.json · artifacts ${scratch}/${evalSlug(id)}/${evalSlug(spec.cell.key)}/${spec.n} · debug ${rel(debug.dir)}`,
    )
    attemptSpan()?.set({ 'reeval.outcome': record.outcome })
    if (record.outcome === 'fail' || record.outcome === 'infra_error') {
      attemptSpan()?.fail(record.error?.message.split('\n')[0] ?? record.outcome)
    }
    setMeta(await writeRecord(a, stagingDir, id))
    if (tracing) {
      try {
        emitAgentSpans(agentSpans(agent(), sentTurns))
      } catch {}
    }
    await debug.finish(debug.verbosity === 2 || record.outcome !== 'pass')
  }
  if (oom) throw oom
  if (failure) throw failure.error
}

/** An attempt's score without graders: 1 when it passed, 0 when it failed; none otherwise. */
function scoreOf(record: EvalRecord): number | undefined {
  if (record.outcome === 'pass') return 1
  return record.error?.kind === 'assertion' || record.error?.kind === 'judge' ? 0 : undefined
}

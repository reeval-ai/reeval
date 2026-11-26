import type { JudgeOn } from '../contract/attempt.ts'
import { INPUT_KEYS, inputsOn, judgeProblem, NO_JUDGE_INPUT } from '../contract/judge.ts'
import { debugLog, debugTrace } from '../debug/attempt.ts'
import { workspaceFiles } from '../diff.ts'
import { getRunContext, SUBJECT } from '../engine/runtime.ts'
import { gatewayScope, resolveModelGateway } from '../gateway/models.ts'
import {
  artifactRefsOf,
  badJudgeArtifacts,
  decideState,
  filePartsOf,
  resolveJudgeArtifacts,
} from '../judge/artifacts.ts'
import { type DraftSource, draftState } from '../judge/draft.ts'
import { judgeModelName, runJudge } from '../judge/index.ts'
import { isApiError, isTransient, type RetriedError } from '../judge/retry.ts'
import { overTokenLimit, withInputSize } from '../judge/size.ts'
import { stateOf } from '../judge/state.ts'
import { mergeJudge, resolveStateOptions } from '../judge/state-options.ts'
import { judgeFailedMessage } from '../matchers.ts'
import { redactSecrets, redactValue } from '../redact.ts'
import { withLease } from '../scheduler/client.ts'
import { clip, formatDuration } from '../text.ts'
import type {
  AttemptContext,
  JSONValue,
  JudgeCallFields,
  JudgeCallOptions,
  JudgeFailure,
  JudgeInput,
  JudgeModel,
  JudgeOptions,
  Turn,
  Verdict,
} from '../types.ts'
import { sandboxFor } from './checks.ts'
import { observedHere, observedName } from './observe.ts'
import type { Attempt } from './state.ts'

/**
 * The attempt's turns as the judge's state draws them, and the graded one's index; a subject the
 * attempt didn't send is drafted alone.
 */
export function judgeTurns(a: Attempt, subject: Turn): { turns: DraftSource[]; subject: number } {
  // By name: spreading a turn reads its `status` getter, which marks the turn's error as read.
  const byName = (turn: Turn, i: number): DraftSource => ({
    prompt: turn.prompt,
    text: turn.text,
    transcript: turn.transcript,
    subagents: a.record.turns[i]?.subagents,
  })
  const at = a.turns.indexOf(subject)
  return at >= 0
    ? { turns: a.turns.map(byName), subject: at }
    : { turns: [byName(subject, -1)], subject: 0 }
}

const noJudgeModel = (configFile: string) =>
  `c.judge() has no model. Set judge: { model: 'typesafe-ai/jev-1.14.0' } in ${configFile}, ` +
  'on the group or eval, or pass { model } to this call.'

/** A turn this attempt sent becomes its index; any other value is graded as the output. */
function judgeOn(turns: readonly Turn[], on: Turn | JSONValue): JudgeOn {
  const turn = turns.indexOf(on as Turn)
  if (turn >= 0) return { turn }
  if (typeof on === 'object' && typeof (on as Partial<Turn> | null)?.exec === 'function') {
    throw new Error("c.judge() on is a turn this attempt didn't send")
  }
  return { value: on as JSONValue }
}

/**
 * Where `order` goes among `calls`, which are in ascending order: calls finish in any order, but
 * what they record stays in the order they were made.
 */
function placeFor(calls: readonly number[], order: number): number {
  const after = calls.findIndex((c) => c > order)
  return after < 0 ? calls.length : after
}

/**
 * Runs `judge` with `options` routed through the gateway the run's list picks for its model, under
 * the model's provider's concurrency lease, as the attempt's judge time.
 */
export function onJudge<T>(
  a: Attempt,
  options: JudgeOptions & { model: JudgeModel },
  judge: (routed: Omit<JudgeOptions, 'maxConcurrent'> & { model: JudgeModel }) => Promise<T>,
): Promise<T> {
  return a.timed('judgeMs', () => routedJudge(options, judge, a.signal))
}

/**
 * A judge call through the run's gateway for its model, under the judge provider's concurrency
 * lease.
 */
export function routedJudge<T>(
  options: JudgeOptions & { model: JudgeModel },
  judge: (routed: Omit<JudgeOptions, 'maxConcurrent'> & { model: JudgeModel }) => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  const { maxConcurrent, ...judgeOptions } = options
  const { config, profile } = getRunContext()
  const scope = gatewayScope(config, profile)
  const gateway = resolveModelGateway(options.model, judgeOptions.gateway, scope, 'judge model')
  const { gateway: _pin, ...unpinned } = judgeOptions
  // The list's entry, so the judge gets its settings (OpenRouter's fallbacks,
  // Vertex's project and regions).
  const entry = gateway && scope.gateways.find((g) => g.kind === gateway)
  const routed = gateway ? { ...unpinned, gateway: entry || gateway } : unpinned
  const provider = judgeModelName(options.model).split('/')[0]
  return withLease(
    maxConcurrent ? { [`judge:${provider}`]: maxConcurrent } : {},
    () => judge(routed),
    signal,
  )
}

/**
 * Grades a turn (the last by default) or a value against a question, under
 * the judge provider's concurrency lease. Every call's input is recorded, including calls that
 * fail. A call that fails returns a `JudgeFailure` and fails the attempt as a judge error after the eval's body, so the judges and
 * checks after it still run.
 */
export function judgeCaller(
  a: Attempt,
  readFile: (path: string) => Promise<string | null>,
): AttemptContext['judge'] {
  const ask = async (
    order: number,
    question: string,
    { on, ...call }: Omit<JudgeCallFields, 'on'> & { on?: JudgeOn },
  ): Promise<Verdict | JudgeFailure> => {
    const problem = judgeProblem(call, { at: 'call' })
    if (problem) throw new Error(problem)
    const badArts = badJudgeArtifacts(call.artifacts)
    if (badArts) throw new Error(`c.judge() artifacts ${badArts}`)
    const subject = on && 'turn' in on ? a.turns[on.turn] : a.turns.at(-1)
    if (!subject) {
      throw new Error(
        on && 'turn' in on
          ? `c.judge() on names turn ${on.turn}, but this attempt has ${a.turns.length}`
          : 'c.judge() has no turn to grade: call c.send() first',
      )
    }
    const wanted = resolveStateOptions(call)
    if (on && 'value' in on && !wanted.output) {
      throw new Error(
        'c.judge() on gives a value to grade as the output, but output is off. Pass output: true.',
      )
    }
    const {
      task: _task,
      output: _output,
      files: _files,
      diff: _diff,
      contents: _contents,
      transcript: _transcript,
      turns: _turns,
      checks: _checks,
      observations: _observations,
      artifacts,
      ...callJudge
    } = call
    const options = mergeJudge(a.spec.judge, callJudge)
    const { model } = options
    if (model === undefined) {
      const message = noJudgeModel(getRunContext().config.file)
      a.judgeThrown.add(message)
      throw new Error(message)
    }
    const output = on && 'value' in on ? on.value : subject.text
    const unobserved = Array.isArray(call.observations)
      ? call.observations.find((n) => !observedHere(a, n))
      : undefined
    if (unobserved !== undefined) {
      throw new Error(
        `c.judge() observations names a value this attempt hasn't observed: ${JSON.stringify(observedName(unobserved))}`,
      )
    }
    const { draft, dropped } = await draftState({
      ...judgeTurns(a, subject),
      output,
      diff: subject.diff,
      wanted,
      checks: a.record.checks,
      observations: a.record.observations,
      readFile,
      listFiles: async () => workspaceFiles(await sandboxFor(a, 'c.judge()'), a.signal),
      who: 'c.judge()',
    })
    const name = judgeModelName(model)
    // Masked as the record will be, so judge-input.json is what the model was sent.
    const state = redactValue(stateOf(draft))
    const resolved = resolveJudgeArtifacts(artifacts, a.artifactBlobs)
    if (artifacts === true && !resolved.length && inputsOn(call, INPUT_KEYS).length === 1) {
      throw new Error(
        'c.judge() artifacts: true shows the judge nothing yet: this attempt has no captures. Call c.capture() first, or turn on another input.',
      )
    }
    const refs = artifactRefsOf(resolved)
    const decide = decideState(state, filePartsOf(resolved))
    const input: JudgeInput = {
      question,
      model: name,
      stateOptions: wanted,
      state,
      ...(refs.length ? { artifacts: refs } : {}),
      ...(dropped.length ? { dropped } : {}),
    }
    const place = placeFor(a.judgeInputCalls, order)
    a.judgeInputCalls.splice(place, 0, order)
    a.record.judgeInputs?.splice(place, 0, input)
    const start = performance.now()
    const ms = () => Math.round(performance.now() - start)
    const atLeast = options.threshold ?? 0.8
    a.report({ kind: 'judge-start', question })
    debugLog('judge', `asking ${name}: ${JSON.stringify(clip(redactSecrets(question), 160))}`)
    if (dropped.length) debugLog('judge', `left out of the judge's input: ${dropped.join(' · ')}`)
    debugTrace('judge', 'prompt', input, 'judge prompt')

    const failed = (
      message: string,
      transient: boolean,
      retries?: RetriedError['retries'],
    ): JudgeFailure => {
      a.judgeErrors.push({
        call: order,
        message: `c.judge(${JSON.stringify(clip(redactSecrets(question), 80))}) failed: ${message}`,
        transient,
        matcher: judgeFailedMessage({ question, model: name, error: message }),
      })
      input.error = message
      if (retries?.length) input.retries = retries
      debugLog('judge', `${name} · ${formatDuration(ms())} · error: ${message}`)
      debugTrace('judge', 'error', { error: message, retries }, 'judge error')
      a.report({
        kind: 'judge-end',
        question,
        verdict: 'error',
        score: null,
        threshold: null,
        ms: ms(),
      })
      return {
        verdict: 'error',
        score: null,
        threshold: atLeast,
        question,
        model: name,
        error: message,
        ...(refs.length ? { artifacts: refs } : {}),
      }
    }

    try {
      const { verdict, retries, usage } = await onJudge(a, { ...options, model }, (routed) =>
        runJudge(question, decide, { ...routed, threshold: atLeast }, a.signal),
      )
      const recorded = refs.length ? { ...verdict, artifacts: refs } : verdict
      const { judgements: judgments } = a.record
      judgments.splice(
        placeFor(
          judgments.map((j) => j.call ?? 0),
          order,
        ),
        0,
        {
          ...recorded,
          ...(options.label ? { label: options.label } : {}),
          ...(retries.length ? { retries } : {}),
          ...(usage ? { usage } : {}),
          call: order,
        },
      )
      const { score } = verdict
      debugLog(
        'judge',
        `${verdict.resolvedModel ?? verdict.model} · ${formatDuration(ms())} · score ${score.toFixed(2)} ${score >= verdict.threshold ? '≥' : '<'} ${verdict.threshold} · ${verdict.verdict}${retries.length ? ` · ${retries.length} retries` : ''} · reason: P(yes) ${score.toFixed(2)} is ${score >= verdict.threshold ? 'at or above' : 'below'} the ${verdict.threshold} threshold`,
      )
      debugTrace('judge', 'response', { verdict, retries }, 'judge response')
      a.report({
        kind: 'judge-end',
        question,
        verdict: verdict.verdict,
        score,
        threshold: verdict.threshold,
        ms: ms(),
      })
      return recorded
    } catch (error) {
      if (a.signal.aborted) throw error
      const { retries } = error as Partial<RetriedError>
      const message = error instanceof Error ? error.message : String(error)
      const transient = isTransient(error) && !overTokenLimit(message, state, question)
      // The input's size can explain a request the provider refused, never an outage.
      const explained =
        isApiError(error) && !transient ? withInputSize(message, state, question) : message
      return failed(explained, transient, retries)
    }
  }
  // A verdict names its question in `expect(verdict).toPass()`'s default label.
  return async (question, given: JudgeCallOptions) => {
    if (typeof question !== 'string' || !question.trim()) {
      throw new Error(
        `c.judge() needs a question: a non-empty string (got ${JSON.stringify(question)})`,
      )
    }
    if (given === null || typeof given !== 'object' || Array.isArray(given)) {
      throw new Error(judgeProblem(given, { at: 'call' }) ?? NO_JUDGE_INPUT)
    }
    const { on, ...options } = given
    const order = a.judgeCalls++
    const call = on === undefined ? options : { ...options, on: judgeOn(a.turns, on) }
    return Object.defineProperty(await ask(order, question, call), SUBJECT, { value: question })
  }
}

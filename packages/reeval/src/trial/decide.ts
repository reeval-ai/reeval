import {
  type Experimental_DecisionState as DecisionState,
  type Experimental_DecisionStatePart as DecisionStatePart,
  experimental_decide as decide,
  Experimental_DecisionUnsupportedQuestionTypeError,
  InvalidArgumentError,
} from 'ai'
import { debugLog, debugTrace } from '../debug/trial.ts'
import { workspaceFiles } from '../diff.ts'
import { getRunContext } from '../engine/runtime.ts'
import { UsageError } from '../errors.ts'
import { gatewayScope, resolveModelGateway } from '../gateway/models.ts'
import { openRouterBilling } from '../gateway/openrouter-models.ts'
import { sha256 } from '../ids.ts'
import { isCaptureHandle } from '../judge/artifacts.ts'
import { draftState } from '../judge/draft.ts'
import { checkModelString, gatewaySettings, RECOMMENDED_JUDGE_MODEL } from '../judge/index.ts'
import { isTransient } from '../judge/retry.ts'
import { stateOf } from '../judge/state.ts'
import { resolveStateOptions } from '../judge/state-options.ts'
import { isObjectLike } from '../object.ts'
import { redactSecrets, redactValue } from '../redact.ts'
import { InfraError } from '../sandbox/types.ts'
import { clip, formatDuration } from '../text.ts'
import type {
  Capture,
  DecideModel,
  DecisionRecord,
  DecisionStateRecord,
  GatewayName,
  JSONValue,
  StateInputs,
  TrialContext,
  Turn,
} from '../types.ts'
import { tokenUsage } from '../usage.ts'
import { sandboxFor } from './checks.ts'
import { judgeTurns } from './judge.ts'
import { observedHere, observedName } from './observe.ts'
import type { Trial } from './state.ts'

/** An AI SDK decision model, or an evaluation model the AI SDK decides with. */
const isDecisionModel = (model: unknown): model is Exclude<DecideModel, string> =>
  isObjectLike(model) &&
  (typeof model.doDecide === 'function' || typeof model.doEvaluate === 'function')

const noDecideModel = (configFile: string) =>
  `c.decide() has no model. Set decide: { model: '${RECOMMENDED_JUDGE_MODEL}' } in ${configFile}, ` +
  'or pass { model } to this call.'

const STATE_KEYS = ['output', 'diff', 'contents', 'observations', 'trajectory', 'on'] as const

const nameOf = (model: DecideModel) =>
  typeof model === 'string' ? model : `${model.provider}/${model.modelId}`

/** The model a call asks: its own, else `decide.model`, else the analysis model when it's a name. */
function modelOf(call: DecideModel | undefined): DecideModel | undefined {
  const { config } = getRunContext()
  if (call !== undefined) return call
  if (config.decide.model !== undefined) return config.decide.model
  return typeof config.analysis.model === 'string' ? config.analysis.model : undefined
}

/** Bytes of a file part's data, when it carries them rather than a URL or a provider reference. */
function bytesOf(data: unknown): Uint8Array | undefined {
  if (typeof data === 'string') return Buffer.from(data, 'base64')
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (isObjectLike(data) && data.type === 'data') return bytesOf(data.data)
  return undefined
}

function urlOf(data: unknown): string | undefined {
  if (data instanceof URL) return data.href
  if (isObjectLike(data) && data.type === 'url') return urlOf(data.url) ?? String(data.url)
  return undefined
}

/** A file part as it's recorded: its hash and size, and the capture it is, never its bytes. */
function fileRecord(
  part: Extract<DecisionStatePart, { type: 'file' }>,
  blobs: Map<string, Buffer>,
): DecisionStateRecord {
  const bytes = bytesOf(part.data)
  const url = bytes ? undefined : urlOf(part.data)
  const hash = bytes && sha256(bytes)
  const capture = hash && [...blobs].find(([, blob]) => sha256(blob) === hash)?.[0]
  return {
    type: 'file',
    mediaType: part.mediaType,
    ...(part.filename ? { filename: redactSecrets(part.filename) } : {}),
    ...(bytes ? { sha256: hash, bytes: bytes.byteLength } : {}),
    ...(url ? { url: redactSecrets(url) } : {}),
    ...(capture ? { capture } : {}),
  }
}

/** `state` masked as the record is, so the model is sent what the trajectory keeps. */
function maskState(state: DecisionState): DecisionState {
  if (typeof state === 'string') return redactSecrets(state)
  if (!Array.isArray(state)) return redactValue(state)
  return (state as readonly DecisionStatePart[]).map((part) => {
    if (part.type === 'text') return { ...part, text: redactSecrets(part.text) }
    if (part.type === 'json') return { ...part, value: redactValue(part.value) }
    return part
  })
}

function stateRecord(state: DecisionState, blobs: Map<string, Buffer>): DecisionRecord['state'] {
  if (typeof state === 'string') return state
  if (!Array.isArray(state)) return state as { [key: string]: JSONValue }
  return (state as readonly DecisionStatePart[]).map((part): DecisionStateRecord => {
    if (part.type === 'text') return { type: 'text', text: part.text }
    if (part.type === 'json') return { type: 'json', value: part.value as JSONValue }
    return fileRecord(part, blobs)
  })
}

/** What the gateway says the call cost: OpenRouter's `usage.cost`, or AI Gateway's `cost`. */
function costOf(gateway: GatewayName | undefined, metadata: unknown): number | undefined {
  if (gateway === 'openrouter') return openRouterBilling(metadata).costUsd
  const cost = (metadata as { gateway?: { cost?: unknown } } | undefined)?.gateway?.cost
  const usd = typeof cost === 'string' || typeof cost === 'number' ? Number(cost) : Number.NaN
  return Number.isFinite(usd) ? usd : undefined
}

/** A mistake in the call itself, which the AI SDK refuses before it asks the provider. */
const isCallMistake = (error: unknown) =>
  InvalidArgumentError.isInstance(error) ||
  Experimental_DecisionUnsupportedQuestionTypeError.isInstance(error)

/** `model`, calling `onSend` as the AI SDK sends it a call. */
function sending<M>(model: M, onSend: () => void): M {
  if (typeof model !== 'object' || model === null) return model
  return new Proxy(model, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      if ((key !== 'doDecide' && key !== 'doEvaluate') || typeof value !== 'function') return value
      return (...args: unknown[]) => {
        onSend()
        return value.apply(target, args)
      }
    },
  })
}

/**
 * The criteria a choice or score question can't go without: the AI SDK reads a missing one as a
 * TypeError rather than an invalid argument.
 */
function missingCriteria(questions: unknown): string | undefined {
  if (!isObjectLike(questions)) return undefined
  for (const [id, q] of Object.entries(questions)) {
    if (!isObjectLike(q)) continue
    if (q.type === 'choice' && !isObjectLike(q.criteria)) {
      return `c.decide() question "${id}" is a choice, so its criteria are an option map, e.g. { criteria: { yes: null, no: null } }`
    }
    if (q.type === 'score' && !Array.isArray(q.criteria)) {
      return `c.decide() question "${id}" is a score, so its criteria are a list of levels, e.g. { criteria: ['poor', 'fair', 'good'] }`
    }
  }
  return undefined
}

/**
 * `c.decide`: one `experimental_decide` call on the call's model, else `decide.model`, else the
 * analysis model. The state and questions are masked before they're sent, and the call is
 * recorded in call order. A provider failure, after the AI SDK's retries, fails the trial as
 * an infrastructure error even when the body catches it.
 */
export function decider(a: Trial): TrialContext['decide'] {
  return (async (call) => {
    if (!isObjectLike(call)) {
      throw new UsageError('c.decide() takes { state, questions }, and optionally a model')
    }
    if (a.ended) throw new UsageError("c.decide() came after the eval's body returned")
    if (a.signal.aborted) {
      throw new UsageError('c.decide() came after the trial timed out or was canceled')
    }
    const { config, profile } = getRunContext()
    const model = modelOf(call.model)
    if (model === undefined) throw new UsageError(noDecideModel(config.file))
    if (typeof model === 'string') {
      const problem = checkModelString(model, 'The decide model', [RECOMMENDED_JUDGE_MODEL])
      if (problem) throw new UsageError(problem)
    } else if (!isDecisionModel(model)) {
      throw new UsageError(
        "c.decide() model must be 'provider/model' or an AI SDK decision model, such as one from a provider's decisionModel()",
      )
    }
    const name = nameOf(model)
    const scope = gatewayScope(config, profile)
    const gateway =
      typeof model === 'string'
        ? resolveModelGateway(model, undefined, scope, 'decide model')
        : undefined
    const entry = gateway && scope.gateways.find((g) => g.kind === gateway)
    const { fallbacks, vertex } = gatewaySettings(entry || gateway)
    const missing = missingCriteria(call.questions)
    if (missing) throw new UsageError(missing)
    const { resolveModel } = await import('../judge/model.ts')
    // A model the run can't reach is the eval's setup, so it fails the trial even when caught.
    const resolved = await resolveModel(model, gateway, fallbacks, vertex, 'decide model').catch(
      (error: unknown) => {
        const usage =
          error instanceof UsageError
            ? error
            : new UsageError(`c.decide(): ${(error as Error).message}`)
        a.infraFailure ??= { error: usage }
        throw usage
      },
    )
    const state = maskState(await call.state)
    const questions = redactValue(call.questions)
    const decision: DecisionRecord = {
      model: name,
      ...(gateway ? { gateway } : {}),
      turn: a.turns.length,
      startedAt: new Date().toISOString(),
      durationMs: 0,
      state: stateRecord(state, a.artifactBlobs),
      questions: questions as unknown as DecisionRecord['questions'],
      answers: {},
      usage: null,
    }
    a.record.decisions ??= []
    const decisions = a.record.decisions
    decisions.push(decision)
    const start = performance.now()
    const ms = () => Math.round(performance.now() - start)
    const { timeoutMs } = config.decide
    const signal = timeoutMs
      ? AbortSignal.any([a.signal, AbortSignal.timeout(timeoutMs)])
      : a.signal
    debugLog('decide', `asking ${name}: ${Object.keys(questions).join(', ')}`)
    debugTrace('decide', 'request', { model: name, state: decision.state, questions }, 'decide')
    let sent = false
    try {
      const result = await decide({
        model: sending(resolved, () => {
          sent = true
        }),
        state,
        questions,
        ...(call.providerOptions ? { providerOptions: call.providerOptions } : {}),
        abortSignal: signal,
      })
      const { answers, usage, warnings, providerMetadata, response } = result
      const costUsd = costOf(gateway, providerMetadata)
      Object.assign(decision, {
        ...(response?.modelId ? { resolvedModel: response.modelId } : {}),
        durationMs: ms(),
        answers: redactValue(answers) as DecisionRecord['answers'],
        usage: usage ? tokenUsage(usage) : null,
        ...(warnings?.length ? { warnings: redactValue(warnings) as JSONValue[] } : {}),
        ...(providerMetadata
          ? {
              providerMetadata: redactValue(providerMetadata) as DecisionRecord['providerMetadata'],
            }
          : {}),
        ...(costUsd !== undefined ? { costUsd } : {}),
      })
      debugLog(
        'decide',
        `${name} · ${formatDuration(ms())} · ${clip(JSON.stringify(answers), 200)}`,
      )
      debugTrace('decide', 'response', { answers, usage, warnings, providerMetadata }, false)
      return { answers, usage, warnings, providerMetadata, response }
    } catch (error) {
      decision.durationMs = ms()
      if (!sent && isCallMistake(error)) {
        decisions.splice(decisions.indexOf(decision), 1)
        throw new UsageError(`c.decide(): ${(error as Error).message}`)
      }
      if (a.signal.aborted) {
        decision.error = 'the trial timed out or was canceled'
        throw a.signal.reason
      }
      const raw = redactSecrets(error instanceof Error ? error.message : String(error))
      const why = signal.aborted
        ? `timed out after ${formatDuration(timeoutMs ?? 0)}`
        : `failed: ${clip(raw, 600).replace(/\.+$/, '')}`
      decision.error = signal.aborted ? why : raw
      debugLog('decide', `${name} · ${formatDuration(ms())} · error: ${decision.error}`)
      const infra = new InfraError(
        `c.decide() with ${name} ${why}. Set decide.model in ${config.file} to a decision model that answers, or pass { model } to the call.`,
        { transient: !signal.aborted && isTransient(error) },
      )
      a.infraFailure ??= { error: infra }
      throw infra
    }
  }) as TrialContext['decide']
}

/** A turn this trial sent, or the latest; refused when `on` isn't one of its turns. */
function turnFor(a: Trial, on: Turn | undefined): Turn | undefined {
  if (on === undefined) return a.turns.at(-1)
  if (!a.turns.includes(on)) throw new UsageError("c.state() on is a turn this trial didn't send")
  return on
}

const NO_TURN: Turn = {
  prompt: '',
  text: '',
  diff: { patch: '', files: [] },
  trajectory: [],
} as unknown as Turn

/**
 * `c.state`: the judge's inputs of the same names as one JSON part, from the latest turn or `on`,
 * masked as a judge's state is.
 */
export function stateBuilder(
  a: Trial,
  readFile: (path: string) => Promise<string | null>,
): TrialContext['state'] {
  return async (inputs) => {
    if (!isObjectLike(inputs)) {
      throw new UsageError('c.state() takes { output, diff, contents, observations, trajectory }')
    }
    const unknown = Object.keys(inputs).find((k) => !(STATE_KEYS as readonly string[]).includes(k))
    if (unknown !== undefined) {
      throw new UsageError(
        `c.state() has no input "${unknown}": it shows ${STATE_KEYS.slice(0, -1).join(', ')}`,
      )
    }
    const { on, ...shown } = inputs as StateInputs
    const wanted = resolveStateOptions(shown)
    const readsTurn = wanted.output || wanted.diff !== false || wanted.trajectory !== false
    const contents = wanted.contents.length > 0
    if (!readsTurn && !contents && !wanted.observations) {
      throw new UsageError(
        'c.state() shows nothing: turn on output, diff, contents, observations or trajectory',
      )
    }
    const subject = turnFor(a, on)
    if (readsTurn && !subject) {
      throw new UsageError('c.state() output, diff and trajectory read a turn: call c.send() first')
    }
    const unobserved = Array.isArray(shown.observations)
      ? shown.observations.find((n) => !observedHere(a, n))
      : undefined
    if (unobserved !== undefined) {
      throw new UsageError(
        `c.state() observations names a value this trial hasn't observed: ${JSON.stringify(observedName(unobserved))}`,
      )
    }
    const turn = subject ?? NO_TURN
    const { draft } = await draftState({
      ...judgeTurns(a, turn),
      output: turn.text,
      diff: turn.diff,
      wanted,
      checks: a.record.checks,
      observations: a.record.observations,
      readFile,
      listFiles: async () => workspaceFiles(await sandboxFor(a, 'c.state()'), a.signal),
      who: 'c.state()',
    })
    return [{ type: 'json', value: redactValue(stateOf(draft)) }]
  }
}

/** `c.part`: a capture's PNG as an image file part. */
export function partOf(a: Trial): TrialContext['part'] {
  return (capture: Capture | string) => {
    const name = isCaptureHandle(capture) ? capture.name : capture
    const data = typeof name === 'string' ? a.artifactBlobs.get(name.trim()) : undefined
    if (!data) {
      throw new UsageError(
        `c.part() names a capture this trial doesn't have: ${JSON.stringify(name)}`,
      )
    }
    return { type: 'file', mediaType: 'image/png', data }
  }
}

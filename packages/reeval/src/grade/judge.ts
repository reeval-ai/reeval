// A judge grader: a question reeval's judge answers about the stored attempt, once per model, with
// what it shows drawn from the stored attempt, and a reference only the judge sees.
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { relative, sep } from 'node:path'
import { createTwoFilesPatch } from 'diff'
import { z } from 'zod'
import { INPUT_KEYS, inputsOn, judgeInputsSchema, turnsSchema } from '../contract/judge.ts'
import { dataProblem } from '../contract/shared.ts'
import { debugTrace } from '../debug/attempt.ts'
import { DefinitionError, isHostFile } from '../environment.ts'
import { canonicalJson } from '../eval-source.ts'
import { sha256 } from '../ids.ts'
import {
  artifactRefsOf,
  decideState,
  filePartsOf,
  resolveJudgeArtifacts,
} from '../judge/artifacts.ts'
import { draftState } from '../judge/draft.ts'
import { checkModelString, isFakeJudge, type JudgeAnswer, judgeModelName } from '../judge/index.ts'
import { isOutage } from '../judge/retry.ts'
import { stateOf } from '../judge/state.ts'
import { resolveStateOptions } from '../judge/state-options.ts'
import { isObjectLike } from '../object.ts'
import { redactSecrets, redactValue } from '../redact.ts'
import { InfraError } from '../sandbox/types.ts'
import { clip } from '../text.ts'
import type {
  Case,
  GradeReads,
  HostFile,
  JSONValue,
  JudgeGrade,
  JudgeGradeCall,
  JudgeModel,
  JudgeState,
} from '../types.ts'
import { GradeError, type GradeInputs } from './context.ts'
import type { JudgeGraderInputs, JudgeReference, JudgeSpec } from './types.ts'

/** The most reference text one judge call shows. */
const REFERENCE_LIMIT = 256 * 1024

const SPEC_KEYS = ['question', 'answers', 'inputs', 'reference', 'model', 'models']

const inputsSchema = judgeInputsSchema.extend({
  turns: turnsSchema.optional(),
  reference: z.enum(['whole', 'diff']).optional(),
})

/** A judge grader as `defineGrader` checked it. */
export type JudgeRun = {
  kind: 'judge'
  names: string[]
  question: string
  answers?: readonly string[]
  inputs: JudgeGraderInputs
  reference?: JudgeReference | ((item: Case) => JudgeReference)
  /** The directory of the file that defines it, which a bare `file()` reference's key is relative to. */
  base: string
  /** Its own models; the eval's judge model when unset. */
  models?: readonly JudgeModel[]
  revision?: number
  timeoutMs: number
}

/** Asks one model the judge's question about `state`. */
export type JudgeAsk = (
  question: string,
  answers: readonly string[] | undefined,
  state: JudgeState,
  model: JudgeModel,
  signal: AbortSignal,
) => Promise<JudgeAnswer>

/** How an attempt's judge graders ask: its judge model, and the call. */
export type GradeJudge = { model?: JudgeModel; ask: JudgeAsk }

/** What a judge grader produced, before it's scored. */
export type JudgeRan = {
  grade?: JSONValue
  error?: string
  models: string[]
  judge: JudgeGrade
  reference?: string
}

function checkModel(model: unknown, field: string, where: string): void {
  if (typeof model === 'string') {
    const problem = checkModelString(model, `${field} in ${where}`)
    if (problem) throw new DefinitionError(problem)
    return
  }
  if (isFakeJudge(model) || (isObjectLike(model) && 'specificationVersion' in model)) return
  throw new DefinitionError(
    `${field} in ${where} must be a "provider/model" string, a decision model or fakeJudge() (got ${JSON.stringify(model)})`,
  )
}

/** A reference as written: text, or host files by path. */
function referenceOf(
  value: unknown,
  where: string,
  base: string,
): { text: string } | { files: Record<string, HostFile> } {
  if (typeof value === 'string') return { text: value }
  if (isHostFile(value)) {
    return { files: { [relative(base, value.path).split(sep).join('/')]: value } }
  }
  if (isObjectLike(value) && !Array.isArray(value) && Object.values(value).every(isHostFile)) {
    if (!Object.keys(value).length) throw new DefinitionError(`reference in ${where} has no files`)
    return { files: value as Record<string, HostFile> }
  }
  throw new DefinitionError(
    `reference in ${where} must be text, file(…), directory(…) or a function of the case returning one (got ${JSON.stringify(value)})`,
  )
}

/** Throws for a reference file that isn't on the host. */
function checkFiles(ref: ReturnType<typeof referenceOf>, where: string): void {
  if (!('files' in ref)) return
  for (const file of Object.values(ref.files)) {
    if (!existsSync(file.path)) {
      throw new DefinitionError(
        `reference in ${where}: ${file.path} doesn't exist. Paths are relative to the file that defines the grader.`,
      )
    }
  }
}

/** `defineGrader`'s `judge` spec, checked. */
export function judgeRunOf(
  judge: unknown,
  names: string[],
  where: string,
  extra: { revision?: number; timeoutMs: number },
  base: string,
): JudgeRun {
  if (!isObjectLike(judge) || Array.isArray(judge)) {
    throw new DefinitionError(
      `judge in ${where} takes a spec, e.g. judge: { question: 'Is it readable?', inputs: { diff: true } }`,
    )
  }
  const spec = judge as Partial<JudgeSpec> & Record<string, unknown>
  const unknown = Object.keys(spec).filter((k) => !SPEC_KEYS.includes(k))
  if (unknown.length) {
    throw new DefinitionError(
      `judge in ${where} doesn't take ${unknown.join(', ')}. It takes ${SPEC_KEYS.join(', ')}.`,
    )
  }
  if (typeof spec.question !== 'string' || !spec.question.trim()) {
    throw new DefinitionError(`judge in ${where} needs a question: a non-empty string`)
  }
  const { answers } = spec
  if (
    answers !== undefined &&
    (!Array.isArray(answers) ||
      answers.length < 2 ||
      answers.some((a) => typeof a !== 'string' || !a.trim()) ||
      new Set(answers).size !== answers.length)
  ) {
    throw new DefinitionError(
      `answers in ${where} must be two or more different answers, e.g. answers: ['good', 'poor'] (got ${JSON.stringify(answers)})`,
    )
  }
  if (spec.model !== undefined && spec.models !== undefined) {
    throw new DefinitionError(`judge in ${where} takes model or models, not both`)
  }
  if (spec.model !== undefined) checkModel(spec.model, 'judge.model', where)
  if (spec.models !== undefined) {
    if (!Array.isArray(spec.models) || !spec.models.length) {
      throw new DefinitionError(
        `judge.models in ${where} must be a list of models, e.g. models: ['typesafe-ai/jev-1.14.0', 'google/gemini-3.8-flash']`,
      )
    }
    spec.models.forEach((m, i) => void checkModel(m, `judge.models[${i}]`, where))
  }
  const inputs = spec.inputs
  const problem = dataProblem(inputsSchema, inputs, `judge.inputs in ${where}`, () =>
    Object.keys(inputsSchema.shape),
  )
  if (problem) throw new DefinitionError(problem)
  const given = inputs as JudgeGraderInputs
  if (!inputsOn(given, [...INPUT_KEYS, 'reference']).length) {
    throw new DefinitionError(
      `judge.inputs in ${where} shows the judge nothing: turn on at least one, such as { diff: true } or { contents: ['src/**'] }. The inputs are ${[...INPUT_KEYS, 'reference'].join(', ')}.`,
    )
  }
  if (given.reference !== undefined && spec.reference === undefined) {
    throw new DefinitionError(
      `judge.inputs.reference in ${where} shows a reference, but the judge has none. Set judge.reference.`,
    )
  }
  if (spec.reference !== undefined && typeof spec.reference !== 'function') {
    checkFiles(referenceOf(spec.reference, where, base), where)
  }
  return {
    kind: 'judge',
    names,
    question: spec.question,
    ...(answers ? { answers } : {}),
    inputs: given,
    base,
    ...(spec.reference !== undefined ? { reference: spec.reference as JudgeRun['reference'] } : {}),
    ...(spec.models
      ? { models: spec.models }
      : spec.model !== undefined
        ? { models: [spec.model] }
        : {}),
    ...(extra.revision !== undefined ? { revision: extra.revision } : {}),
    timeoutMs: extra.timeoutMs,
  }
}

/** A judge grader's `score`, checked: every answer's score in [0, 1], as a table. */
export function judgeScoreOf(
  score: unknown,
  answers: readonly string[] | undefined,
  where: string,
): Record<string, number> | undefined {
  const keys = answers ?? ['true', 'false']
  if (score === undefined) return undefined
  const usage = `score in ${where} must give each answer a score in [0, 1], e.g. score: { ${keys.map((k) => `${JSON.stringify(k)}: …`).join(', ')} }`
  if (!isObjectLike(score) || Array.isArray(score)) throw new DefinitionError(usage)
  const table = score as Record<string, unknown>
  const extra = Object.keys(table).filter((k) => !keys.includes(k))
  if (extra.length) {
    throw new DefinitionError(
      `${usage} (${extra.map((k) => JSON.stringify(k)).join(', ')} isn't one)`,
    )
  }
  const bad = keys.find((k) => typeof table[k] !== 'number' || !(table[k] >= 0 && table[k] <= 1))
  if (bad !== undefined) {
    throw new DefinitionError(
      `${usage} (${table[bad] === undefined ? `no score for ${JSON.stringify(bad)}` : `${JSON.stringify(bad)} has ${JSON.stringify(table[bad])}`})`,
    )
  }
  return table as Record<string, number>
}

/** The score of a judge grade: the mean of each model's answer's score in `table`. */
export function judgeScore(table: Record<string, number>): (grade: never) => number {
  return (grade: JSONValue) => {
    const answers = Array.isArray(grade) ? grade : [grade]
    return answers.reduce<number>((sum, a) => sum + (table[String(a)] ?? 0), 0) / answers.length
  }
}

/** The part of a judge grader's fingerprint its spec gives: name, question, answers, inputs and models. */
export function judgeCode(run: JudgeRun, name: string, models: readonly string[]): string {
  return sha256(
    canonicalJson({
      name,
      judge: {
        question: run.question,
        answers: run.answers ?? null,
        inputs: run.inputs as unknown as JSONValue,
        models: [...models],
      },
    }),
  )
}

type ReadReference = {
  digest: string
  files: number
  /** Text, or each file's content by path (null for a binary file). */
  shown: { text: string } | { files: Record<string, string | null> }
}

/** The judge grader's reference for `item`, read from the host; undefined without one. */
export async function readReference(
  run: JudgeRun,
  item: Case,
  who: string,
): Promise<ReadReference | undefined> {
  if (run.reference === undefined) return undefined
  const given = typeof run.reference === 'function' ? run.reference(item) : run.reference
  const ref = referenceOf(given, who, run.base)
  if ('text' in ref) {
    return { digest: sha256(canonicalJson({ text: sha256(ref.text) })), files: 0, shown: ref }
  }
  const paths = Object.keys(ref.files).sort()
  const bytes = await Promise.all(
    paths.map(async (path) => {
      const file = ref.files[path] as HostFile
      try {
        return await readFile(file.path)
      } catch {
        throw new GradeError(`${who}'s reference ${path}: ${file.path} can't be read`)
      }
    }),
  )
  return {
    digest: sha256(canonicalJson(paths.map((path, i) => [path, sha256(bytes[i] as Buffer)]))),
    files: paths.length,
    shown: {
      files: Object.fromEntries(
        paths.map((path, i) => {
          const b = bytes[i] as Buffer
          return [path, b.includes(0) ? null : b.toString('utf8')]
        }),
      ),
    },
  }
}

/** The reference as the judge sees it, at most `REFERENCE_LIMIT` characters of it. */
async function referenceShown(
  ref: ReadReference,
  mode: 'whole' | 'diff',
  readAttempt: (path: string) => Promise<string | null>,
): Promise<JSONValue> {
  if ('text' in ref.shown) return ref.shown.text
  let left = REFERENCE_LIMIT
  const notShown: string[] = []
  const parts: Array<[string, string]> = []
  for (const [path, text] of Object.entries(ref.shown.files)) {
    let part: string
    if (text === null) part = '[reeval: binary file not shown]'
    else if (mode === 'whole') part = text
    else {
      const theirs = await readAttempt(path)
      if (theirs === null) part = "[reeval: not in the attempt's workspace]"
      else if (theirs === text) part = '[reeval: unchanged]'
      else
        part = createTwoFilesPatch(`reference/${path}`, path, text, theirs, '', '', { context: 3 })
    }
    if (part.length > left) {
      notShown.push(path)
      continue
    }
    left -= part.length
    parts.push([path, part])
  }
  return {
    ...Object.fromEntries(parts),
    ...(notShown.length
      ? {
          '[reeval: not shown]': `${notShown.join(', ')}: over ${REFERENCE_LIMIT / 1024} KiB of reference`,
        }
      : {}),
  }
}

/** What a judge grader read of the attempt, by content hash, as it reads it. */
export type Reads = {
  reads: () => GradeReads
  file: (path: string, sha: string) => void
  observation: (name: string, sha: string) => void
  artifact: (name: string, sha: string) => void
}

export function readsOf(): Reads {
  const observations = new Map<string, { name: string; sha256: string }>()
  const artifacts = new Map<string, { name: string; sha256: string }>()
  const files = new Map<string, { path: string; sha256: string }>()
  return {
    file: (path, sha) => void files.set(path, { path, sha256: sha }),
    observation: (name, sha) => void observations.set(name, { name, sha256: sha }),
    artifact: (name, sha) => void artifacts.set(name, { name, sha256: sha }),
    reads: () => ({
      ...(observations.size ? { observations: [...observations.values()] } : {}),
      ...(artifacts.size ? { artifacts: [...artifacts.values()] } : {}),
      ...(files.size ? { files: [...files.values()] } : {}),
    }),
  }
}

/**
 * Asks the judge grader's question of each model about the stored attempt. A model's provider
 * failing the call (`isOutage`) is the attempt's infra error, thrown; any other failure is the
 * grade's error.
 */
export async function runJudgeGrader(
  run: JudgeRun,
  inputs: GradeInputs,
  reads: Reads,
  signal: AbortSignal,
): Promise<JudgeRan> {
  const who =
    run.names.length === 1
      ? `judge grader ${run.names[0]}`
      : `judge graders ${run.names.join(', ')}`
  const judge: JudgeGrade = {}
  const models = run.models ?? (inputs.judge?.model !== undefined ? [inputs.judge.model] : [])
  const names = models.map(judgeModelName)
  const failed = (error: string, reference?: string): JudgeRan => ({
    error,
    models: names,
    judge,
    ...(reference ? { reference } : {}),
  })
  let ref: ReadReference | undefined
  try {
    ref = await readReference(run, inputs.case, who)
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error))
  }
  if (ref) judge.reference = { digest: ref.digest, files: ref.files }
  if (!models.length || !inputs.judge) {
    return failed(
      `${who} has no model. Set judge: { model: 'typesafe-ai/jev-1.14.0' } in the config or on the eval, or model in its judge spec.`,
      ref?.digest,
    )
  }
  const { stored } = inputs
  const { workspace } = stored
  const readAttempt = async (path: string): Promise<string | null> => {
    const entry = workspace?.manifest.files.find((f) => f.path === path)
    const bytes = entry ? await workspace?.readFile(path) : null
    if (!entry || !bytes) return null
    reads.file(path, entry.sha256 ?? sha256(bytes))
    return bytes.toString('utf8')
  }
  const wanted = resolveStateOptions(run.inputs)
  const observed = stored.observations
  if (wanted.observations) {
    const missing = Array.isArray(wanted.observations)
      ? wanted.observations.find((n) => !observed.some((o) => o.name === n))
      : undefined
    if (missing !== undefined) {
      return failed(
        `${who} observations names a value this attempt didn't observe: ${JSON.stringify(missing)}`,
        ref?.digest,
      )
    }
    for (const o of observed) {
      if (wanted.observations === true || wanted.observations.includes(o.name)) {
        reads.observation(o.name, o.sha256 ?? sha256(JSON.stringify(o.value)))
      }
    }
  }
  const turns = inputs.turns
  const last = Math.max(0, turns.length - 1)
  let state: JudgeState
  try {
    const { draft, dropped } = await draftState({
      turns: turns.map((t, i) => ({ ...t, subagents: inputs.subagents?.[i] })),
      subject: last,
      output: turns[last]?.text ?? '',
      diff: stored.diff,
      wanted,
      checks: stored.execs,
      observations: observed,
      readFile: readAttempt,
      listFiles: async () => workspace?.manifest.files.map((f) => f.path) ?? [],
      who,
    })
    if (dropped.length) judge.dropped = dropped
    const json = {
      ...stateOf(draft),
      ...(ref
        ? { reference: await referenceShown(ref, run.inputs.reference ?? 'whole', readAttempt) }
        : {}),
    }
    const blobs = new Map<string, Buffer>()
    const wantedArtifacts = run.inputs.artifacts
    if (wantedArtifacts) {
      const names =
        wantedArtifacts === true
          ? stored.artifacts.map((a) => a.name)
          : wantedArtifacts.map((a) => (typeof a === 'string' ? a : a.name))
      for (const name of names) {
        const png = await stored.readArtifact(name)
        if (!png)
          throw new GradeError(
            `${who} artifacts names a capture this attempt doesn't have: ${JSON.stringify(name)}`,
          )
        blobs.set(name, png)
      }
    }
    const resolved = resolveJudgeArtifacts(wantedArtifacts ? [...blobs.keys()] : undefined, blobs)
    for (const a of artifactRefsOf(resolved)) reads.artifact(a.name, a.sha256)
    const masked = redactValue(json)
    debugTrace(
      'judge',
      'prompt',
      { question: run.question, state: masked },
      `judge grader ${run.names.join(', ')} prompt`,
    )
    state = decideState(masked, filePartsOf(resolved))
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error), ref?.digest)
  }
  const settled = await Promise.allSettled(
    models.map((model) =>
      (inputs.judge as GradeJudge).ask(run.question, run.answers, state, model, signal),
    ),
  )
  const down = settled.findIndex((s) => s.status === 'rejected' && isOutage(s.reason))
  if (down >= 0) {
    const { reason } = settled[down] as PromiseRejectedResult
    throw new InfraError(
      `The judge's provider failed ${who} on ${names[down]}: ${clip(redactSecrets(reason.message), 2000)}`,
      { transient: true },
    )
  }
  const calls: JudgeGradeCall[] = []
  let failure: string | undefined
  for (const [i, s] of settled.entries()) {
    if (s.status === 'rejected') {
      const why = s.reason instanceof Error ? s.reason.message : String(s.reason)
      failure ??= `${names[i]}: ${why}`
      continue
    }
    const { answer, probability, model, resolvedModel, gateway, costUsd, usage, retries } = s.value
    calls.push({
      model,
      answer,
      ...(probability !== undefined ? { probability } : {}),
      ...(resolvedModel ? { resolvedModel } : {}),
      ...(gateway ? { gateway } : {}),
      ...(costUsd !== undefined ? { costUsd } : {}),
      ...(usage ? { usage } : {}),
      ...(retries.length ? { retries } : {}),
    })
  }
  if (calls.length) judge.calls = calls
  if (failure) return failed(failure, ref?.digest)
  const answers = calls.map((c) => c.answer)
  return {
    grade: answers.length === 1 ? (answers[0] as JSONValue) : answers,
    models: names,
    judge,
    ...(ref ? { reference: ref.digest } : {}),
  }
}

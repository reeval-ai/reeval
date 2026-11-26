// The judge options' contract: the model, provider options, gateway and concurrency, and the
// inputs a judge is shown beside the question. Their data form is the config's (a model by name
// or a fake judge); groups and evals also take an AI SDK model object, which only TypeScript can
// hold, so the authored schemas accept any model and the cascade checks it later.
import { z } from 'zod'
import { checkModelString } from '../judge/index.ts'
import type {
  Capture,
  ConfigJudgeData,
  FakeJudgeData,
  JudgeInputs,
  JudgeModel,
  JudgeOptions,
} from '../types.ts'
import { GATEWAY_NAMES, gatewayDescriptorSchema, gatewayNameSchema } from './gateway.ts'
import { type Assert, type Issue, jsonValueSchema, nonEmpty, type Same } from './shared.ts'

/** The refusal for a transcript view that shows neither the agent's events nor its subagents'. */
export const NO_TRANSCRIPT = 'shows the judge no transcript; use transcript: false'

/** The inputs every judge and question shares; a judge adds `contents` and `artifacts`. */
export const sharedInputFields = {
  task: z.boolean().optional(),
  output: z.boolean().optional(),
  files: z.boolean().optional(),
  diff: z.union([z.boolean(), z.array(nonEmpty()).min(1)]).optional(),
  transcript: z
    .union([
      z.boolean(),
      z.enum(['tools', 'full']),
      z
        .strictObject({
          detail: z.enum(['tools', 'full']).optional(),
          agent: z.boolean().optional(),
          subagents: z.boolean().optional(),
        })
        .refine((v) => v.agent !== false || v.subagents !== false, NO_TRANSCRIPT),
    ])
    .optional(),
  checks: z.union([z.boolean(), z.array(nonEmpty())]).optional(),
  observations: z.union([z.boolean(), z.array(nonEmpty())]).optional(),
}

export const turnsSchema = z.enum(['last', 'all'])

const { task, output, files, diff, transcript, checks, observations } = sharedInputFields

export const judgeInputsSchema = z.strictObject({
  task,
  output,
  files,
  diff,
  contents: z.array(nonEmpty()).optional(),
  transcript,
  checks,
  observations,
  artifacts: z.union([z.literal(true), z.array(z.custom<Capture | string>())]).optional(),
})

export const INPUT_KEYS = Object.keys(judgeInputsSchema.shape) as Array<keyof JudgeInputs>

/** True when an input's value turns it on: not `false`, unset or an empty list. */
export const inputOn = (value: unknown): boolean =>
  value !== undefined && value !== false && !(Array.isArray(value) && value.length === 0)

/** The input keys an options object turns on, in `keys`' order. */
export const inputsOn = (value: Record<string, unknown>, keys: readonly string[]): string[] =>
  keys.filter((k) => inputOn(value[k]))

/** `a`, `b` and `c` as prose: "a, b or c". */
export const orList = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`

export const judgeFields = {
  providerOptions: z.record(z.string(), z.record(z.string(), jsonValueSchema)).optional(),
  maxConcurrent: z.number().int().min(1).optional(),
  gateway: z.union([gatewayNameSchema, gatewayDescriptorSchema]).optional(),
}

export const fakeJudgeDataSchema = z.strictObject({
  kind: z.literal('fake-judge'),
  score: z.number().min(0).max(1),
})

export const judgeModelNameSchema = z
  .string()
  .regex(/\//, "must be a 'provider/model' string, e.g. 'google/gemini-3.8-flash'")

export const configJudgeDataSchema = z.strictObject({
  model: z.union([z.string(), fakeJudgeDataSchema]).optional(),
  ...judgeFields,
})

export const judgeOptionsSchema = z.strictObject({
  model: z.custom<JudgeModel>().optional(),
  ...judgeFields,
})

export type _SameAsSchema = [
  Assert<Same<z.infer<typeof judgeInputsSchema>, JudgeInputs>>,
  Assert<Same<keyof z.infer<typeof judgeInputsSchema>, keyof JudgeInputs>>,
  Assert<Same<z.infer<typeof fakeJudgeDataSchema>, FakeJudgeData>>,
  Assert<Same<z.infer<typeof configJudgeDataSchema>, ConfigJudgeData>>,
  Assert<Same<keyof z.infer<typeof configJudgeDataSchema>, keyof ConfigJudgeData>>,
  Assert<Same<z.infer<typeof judgeOptionsSchema>, JudgeOptions>>,
  Assert<Same<keyof z.infer<typeof judgeOptionsSchema>, keyof JudgeOptions>>,
]

/**
 * Where judge options are checked, which decides the sentence: an eval's or group's options
 * (`where` names them), or the config or a profile (`path` is `judge` or `profiles.<name>.judge`
 * in `file`).
 */
export type JudgeSite =
  | { at: 'options'; where: string }
  | { at: 'config'; path: string; file: string }

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0] ?? 0
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const here = row[j] ?? 0
      row[j] = Math.min(here + 1, (row[j - 1] ?? 0) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = here
    }
  }
  return row[b.length] ?? 0
}

const nearest = (key: string, keys: readonly string[]) =>
  keys.find((k) => distance(key.toLowerCase(), k.toLowerCase()) <= 2)

/** A transcript view with both the agent's events and its subagents' turned off. */
export const showsNoTranscript = (value: unknown) =>
  typeof value === 'object' &&
  value !== null &&
  (value as { agent?: unknown }).agent === false &&
  (value as { subagents?: unknown }).subagents === false

const shown = (value: unknown) => JSON.stringify(value) ?? String(value)

/**
 * The first problem with a judge options object, as one sentence, or undefined. The checks run in
 * the order each site has always run them, so a value with several problems names the same one.
 */
export function judgeProblem(judge: unknown, site: JudgeSite): string | undefined {
  /** A judge field and where it was set: `judge.gateway in evals/a.eval.ts › e`. */
  const field = (key?: string) => {
    const base = site.at === 'config' ? site.path : 'judge'
    return `${key ? `${base}.${key}` : base} in ${site.at === 'config' ? site.file : site.where}`
  }
  const loc =
    site.at === 'options'
      ? ` in ${site.where}`
      : ` in ${site.path === 'judge' ? '' : `${site.path.replace(/\.judge$/, '')} in `}${site.file}`
  if (typeof judge !== 'object' || judge === null || Array.isArray(judge)) {
    return `${field()} must be an object such as { model: 'google/gemini-3.8-flash' } (got ${shown(judge)})`
  }
  const value = judge as Record<string, unknown>
  const model = value.model as { kind?: unknown; score?: unknown } | string | null | undefined
  if (site.at === 'config' && typeof model === 'string') {
    const problem = checkModelString(model, field('model'))
    if (problem) return problem
  }
  const schema = site.at === 'config' ? configJudgeDataSchema : judgeOptionsSchema
  const parsed = schema.safeParse(judge)
  if (parsed.success) return undefined
  // The rest of a numeric fake judge (its score's range, a stray key) is left to the config's data
  // check, which names the file it's in.
  const numericFake =
    site.at === 'config' &&
    typeof model === 'object' &&
    model?.kind === 'fake-judge' &&
    typeof model.score === 'number'
  const issues = parsed.error.issues.filter((i) => !(numericFake && i.path[0] === 'model'))
  if (!issues.length) return undefined
  const at = (key: string) => issues.some((i) => i.path[0] === key)
  const modelProblem = () => {
    if (site.at !== 'config' || !at('model')) return undefined
    if (typeof model === 'object' && model?.kind === 'fake-judge') {
      return `${field('model')} must be fakeJudge({ score }) with a number. Pass a score function per group or eval instead.`
    }
    return `${field('model')} must be a "provider/model" string or fakeJudge(). Pass a model object per group or eval instead.`
  }
  const maxConcurrentProblem = () => {
    if (site.at === 'config' || !at('maxConcurrent')) return undefined
    return `${field('maxConcurrent')} must be a whole number of at least 1 (got ${shown(value.maxConcurrent)})`
  }
  const keyProblem = () => {
    const key = issues.find((i) => i.code === 'unrecognized_keys' && i.path.length === 0)
    const name = (key as (Issue & { keys: string[] }) | undefined)?.keys[0]
    if (name === undefined) return undefined
    const hint = nearest(name, Object.keys(schema.shape))
    const why = (INPUT_KEYS as readonly string[]).includes(name)
      ? ` ${name} is a judge grader's input: judge(question, { inputs: { ${name} } }).`
      : hint
        ? ` Did you mean "${hint}"?`
        : ''
    return `Unknown judge option "${name}"${loc}.${why}`
  }
  const providerOptionsProblem = () =>
    at('providerOptions')
      ? `${field('providerOptions')} must map each provider to an object of JSON values, e.g. { google: { thinkingConfig: { thinkingBudget: 0 } } } (got ${shown(value.providerOptions)})`
      : undefined
  const gatewayProblem = () =>
    at('gateway')
      ? `${field('gateway')} names a gateway in the config's gateway list: ${GATEWAY_NAMES.map((g) => `'${g}'`).join(' or ')}, or is its helper (got ${shown(value.gateway)})`
      : undefined
  const order =
    site.at === 'config'
      ? [modelProblem, keyProblem, providerOptionsProblem, gatewayProblem]
      : [maxConcurrentProblem, keyProblem, providerOptionsProblem, gatewayProblem]
  for (const check of order) {
    const problem = check()
    if (problem) return problem
  }
  return `judge options${loc} aren't valid: ${issues[0]?.message ?? 'unknown problem'}`
}

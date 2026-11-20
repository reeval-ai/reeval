// The presentation every surface renders: the terminal (`reeval/renderer/ascii`), summary.md
// (`reeval/renderer/markdown`) and the studio's report component. `present()` builds it from a
// `RunReport` and formats every number once, so a renderer only lays it out: each figure carries
// the text all three print.
import { z } from 'zod'

const text = z.string()

/** A displayed number: `value` for charts, `text` as every surface prints it. */
export const figureSchema = z.strictObject({ value: z.number().nullable(), text })
/** `k` of `n`, as `text` (`3 of 4`). */
export const countSchema = z.strictObject({
  k: z.number().int().nonnegative(),
  n: z.number().int().nonnegative(),
  text,
})
/** A pass rate over counted attempts: `text` is the percent (`75%`, `n/a` at n = 0). */
export const rateSchema = z.strictObject({
  k: z.number().int().nonnegative(),
  n: z.number().int().nonnegative(),
  rate: z.number().nullable(),
  text,
  /** `3 of 4`. */
  of: text,
  /** Wilson's 95% interval as `51% to 100%`; null at n = 0. */
  interval: text.nullable(),
})
/** A link to one attempt: its index id (`A3`) and where it points. */
export const citeSchema = z.strictObject({ id: text, href: text })

/**
 * What an eval came to. Infra errors and canceled attempts never count as a fail; `ungated` is an
 * eval that ran with nothing gated, so it neither passed nor failed.
 */
export const verdictSchema = z.enum([
  'pass',
  'fail',
  'ungated',
  'infra-error',
  'canceled',
  'skipped',
  'todo',
  'not-run',
])
/** A variant's effect on the pass rate against the baseline. */
export const effectSchema = z.enum(['helped', 'made-worse', 'same', 'too-few'])
export const outcomeSchema = z.enum(['pass', 'fail', 'infra-error', 'canceled'])

/** What a headline leads with, in the form of its data. */
export const metricSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('rate'),
    /** The big number: the pass rate, or the metric the eval leads with (`task average`). */
    value: figureSchema,
    /** What `value` is: `passed`, `found`, `used`, `task average`, `Pass@3`. */
    label: text,
    rate: rateSchema,
  }),
  z.strictObject({
    kind: z.literal('compare'),
    baseline: z.strictObject({ label: text, rate: rateSchema }),
    variant: z.strictObject({ label: text, rate: rateSchema }),
    effect: effectSchema.nullable(),
    /** `helped`, `made it worse`, `same`, `too few runs`. */
    effectText: text.nullable(),
  }),
  z.strictObject({
    kind: z.literal('counts'),
    question: text,
    options: z.array(z.strictObject({ label: text, count: countSchema })),
  }),
  z.strictObject({ kind: z.literal('median'), label: text, value: figureSchema }),
  z.strictObject({
    kind: z.literal('score'),
    label: text,
    value: figureSchema,
    /** `0 to 1`. */
    scale: text,
  }),
  z.strictObject({ kind: z.literal('quote'), question: text, text, cite: citeSchema.nullable() }),
  z.strictObject({ kind: z.literal('changes'), worse: figureSchema, fixed: figureSchema }),
  /** No attempt ran: `skipped`, `todo`, `no attempts ran`. */
  z.strictObject({ kind: z.literal('none'), text }),
])

export const headerSchema = z.strictObject({
  title: text,
  runId: text,
  status: z.enum(['complete', 'interrupted', 'budget']),
  /** `stopped early (interrupted)`; null when complete. */
  stopped: text.nullable(),
  startedAt: text,
  /** `2026-11-20`. */
  date: text,
  author: text,
  reeval: text,
  profile: text.nullable(),
  /** `1 run per cell`, `varying runs per cell`. */
  runs: text,
  git: z
    .strictObject({
      repo: text.nullable(),
      branch: text.nullable(),
      sha: text,
      dirty: z.boolean(),
      /** `reeval@82137cd (dirty)`. */
      text,
    })
    .nullable(),
  wall: figureSchema,
  tokens: figureSchema,
  cost: figureSchema,
  /** Passed of counted attempts, over every eval. */
  counted: countSchema,
  infraError: z.number().int().nonnegative(),
  canceled: z.number().int().nonnegative(),
  /** `2 of 4 counted attempts passed · 5 infra errors`. */
  attempts: text,
  /** `Cursor · composer-2.5 served by Anthropic 2; judge served by Google 1`, one per harness. */
  servedBy: z.array(text),
})

export const tallySchema = z.strictObject({
  pass: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative(),
  infraError: z.number().int().nonnegative(),
  canceled: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  todo: z.number().int().nonnegative(),
  notRun: z.number().int().nonnegative(),
  ungated: z.number().int().nonnegative(),
  /** `2 fail · 2 pass · 1 infra error · 2 skipped`, evals by verdict. */
  text,
})

export const caveatSchema = z.strictObject({
  severity: z.enum(['error', 'warn']),
  text,
  evalId: text.nullable(),
  cites: z.array(citeSchema),
})

export const harnessSchema = z.strictObject({
  id: text,
  /** `Claude Code`, or the id when reeval has no name for it. */
  name: text,
  model: text.nullable(),
  /** `Claude Code · claude-sonnet-5`: how every surface names it. */
  label: text,
  servedModels: z.array(text),
  gateway: text.nullable(),
  attempts: figureSchema,
})

export const armSchema = z.strictObject({
  id: text,
  /** `baseline` for the environment `-`. */
  label: text,
  role: z.enum(['baseline', 'variant', 'only']),
  gated: z.boolean(),
  rate: rateSchema,
  infraError: z.number().int().nonnegative(),
  canceled: z.number().int().nonnegative(),
  /** `1 infra error, 1 canceled`: what the rate leaves out; null when nothing. */
  left: text.nullable(),
  effect: effectSchema.nullable(),
  effectText: text.nullable(),
  /** Points against the baseline with its interval, for `-v`; null on the baseline. */
  lift: text.nullable(),
  tokens: figureSchema,
  agentTime: figureSchema,
  cost: figureSchema,
  costPerPass: figureSchema,
})

export const attemptSchema = z.strictObject({
  id: text,
  key: text,
  href: text,
  /** The harness's label. */
  harness: text,
  arm: text.nullable(),
  case: text.nullable(),
  outcome: outcomeSchema,
  /** `pass`, `fail`, `infra error`, `canceled`. */
  outcomeText: text,
  /** Why it didn't pass, its first line; null when it passed. */
  note: text.nullable(),
  tokens: figureSchema,
  agentTime: figureSchema,
  cost: figureSchema,
})

export const caseSchema = z.strictObject({
  label: text,
  cells: z.array(z.strictObject({ column: text, rate: rateSchema.nullable() })),
})

export const checkSchema = z.strictObject({
  label: text,
  matcher: text,
  at: text.nullable(),
  failed: z.boolean(),
  cells: z.array(z.strictObject({ column: text, text })),
  total: text,
})

export const failureSchema = z.strictObject({
  kind: z.enum([
    'assertion',
    'turn-error',
    'infra-error',
    'capture-error',
    'error',
    'timeout',
    'canceled',
  ]),
  /** `failed check`, `turn error`, `infra error`, `capture error`, `error`. */
  kindText: text,
  label: text,
  message: text.nullable(),
  /** The failure text past `message`'s line, for `-v`; null when it has one line. */
  detail: text.nullable(),
  at: text.nullable(),
  count: countSchema,
  /** `all on base, not gated`, `all on Bad`: where every failing attempt ran; null when spread. */
  where: text.nullable(),
  attempts: z.array(citeSchema),
})

export const effortSchema = z.strictObject({
  /** The arm or harness the row is for, or `median`. */
  label: text,
  tokens: figureSchema,
  toolCalls: figureSchema,
  agentTime: figureSchema,
  cost: figureSchema,
  costPerPass: figureSchema,
})

export const questionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('choices'),
    question: text,
    options: z.array(z.strictObject({ label: text, count: countSchema })),
    /** `2 without a pick`; null when every attempt picked. */
    noPick: text.nullable(),
  }),
  z.strictObject({
    kind: z.literal('pairwise'),
    question: text,
    a: text,
    b: text,
    /** `won 8 of 8`. */
    aWins: countSchema,
    bWins: countSchema,
    ties: figureSchema,
  }),
  z.strictObject({
    kind: z.literal('answers'),
    question: text,
    answered: countSchema,
    entries: z.array(z.strictObject({ text, harness: text, cite: citeSchema })),
  }),
])

export const judgmentSchema = z.strictObject({
  label: text,
  question: text,
  /** `0.7`, or `diagnostic`. */
  threshold: text,
  median: figureSchema,
  /** At or above the threshold; null on a diagnostic judgment. */
  atOrAbove: countSchema.nullable(),
})

export const discoverySchema = z.strictObject({
  what: text,
  found: countSchema,
  rows: z.array(z.strictObject({ label: text, found: countSchema })),
})

export const captureSchema = z.strictObject({
  harness: text,
  arm: text.nullable(),
  case: text.nullable(),
  name: text,
  href: text.nullable(),
  attempt: citeSchema,
  /** `HTTP 200, 0 page errors`. */
  status: text,
})

export const regressionSchema = z.strictObject({
  /** `2026-09-27, 82137cd, main`. */
  prior: text,
  priorRunId: text,
  priorAuthor: text,
  /** The inputs that changed since the prior run. */
  whatChanged: z.array(text),
  rows: z.array(
    z.strictObject({
      signal: text,
      kind: text,
      harness: text.nullable(),
      prior: text,
      current: text,
      delta: text,
      status: text,
    }),
  ),
  unchanged: figureSchema,
})

export const evalSchema = z.strictObject({
  id: text,
  anchor: text,
  /** The full path: `house greeting › greets in the house style`. */
  name: text,
  file: text,
  /** `Task`, `A/B`, `Discoverability`, `Regression`. */
  shapes: z.array(text),
  /** `2 coding harnesses, 2 arms, 4 attempts`. */
  design: text,
  state: z.enum(['ran', 'skipped', 'todo', 'not-run']),
  verdict: verdictSchema,
  /** `pass`, `fail`, `infra error`, `canceled`, `skipped`, `todo`, `not run`. */
  verdictText: text,
  headline: z.strictObject({
    task: text,
    metric: metricSchema,
    /** The sample: `3 of 4 attempts`. */
    foot: text,
    /** What the rate leaves out: `1 infra error`; null when nothing. */
    left: text.nullable(),
  }),
  arms: z.array(armSchema),
  attempts: z.array(attemptSchema),
  cases: z.array(caseSchema),
  checks: z.array(checkSchema),
  failures: z.array(failureSchema),
  effort: z.array(effortSchema),
  questions: z.array(questionSchema),
  judgments: z.array(judgmentSchema),
  discovery: z.array(discoverySchema),
  captures: z.array(captureSchema),
  regression: regressionSchema.nullable(),
  /** The edits the run's remarks name, and where. */
  next: z.array(z.strictObject({ text, at: text.nullable() })),
  /** The run's remarks on this eval, one line each. */
  remarks: z.array(text),
  /** `-v` only: intervals, points and the other pass metrics. */
  stats: z.array(text),
})

export const actionSchema = z.strictObject({ text, cites: z.array(citeSchema) })

export const provenanceSchema = z.strictObject({
  rows: z.array(z.strictObject({ field: text, value: text })),
  warnings: z.array(text),
})

export const attemptIndexSchema = z.strictObject({
  id: text,
  /** The HTML id an attempt's citation points at. */
  anchor: text,
  eval: text,
  harness: text,
  arm: text.nullable(),
  case: text.nullable(),
  outcomeText: text,
  tokens: figureSchema,
  agentTime: figureSchema,
  toolCalls: figureSchema,
  diff: text,
  links: z.array(z.strictObject({ name: text, href: text })),
})

export const runPresentationSchema = z.strictObject({
  presentationVersion: z.literal(1),
  header: headerSchema,
  tally: tallySchema,
  caveats: z.array(caveatSchema),
  harnesses: z.array(harnessSchema),
  evals: z.array(evalSchema),
  actions: z.array(actionSchema),
  provenance: provenanceSchema,
  attemptIndex: z.array(attemptIndexSchema),
})

export type Figure = z.infer<typeof figureSchema>
export type Count = z.infer<typeof countSchema>
export type Rate = z.infer<typeof rateSchema>
export type Cite = z.infer<typeof citeSchema>
export type Verdict = z.infer<typeof verdictSchema>
export type Effect = z.infer<typeof effectSchema>
export type Outcome = z.infer<typeof outcomeSchema>
export type Metric = z.infer<typeof metricSchema>
export type Header = z.infer<typeof headerSchema>
export type Tally = z.infer<typeof tallySchema>
export type Caveat = z.infer<typeof caveatSchema>
export type HarnessRow = z.infer<typeof harnessSchema>
export type ArmRow = z.infer<typeof armSchema>
export type AttemptRow = z.infer<typeof attemptSchema>
export type CaseRow = z.infer<typeof caseSchema>
export type CheckRow = z.infer<typeof checkSchema>
export type FailureRow = z.infer<typeof failureSchema>
export type EffortRow = z.infer<typeof effortSchema>
export type Question = z.infer<typeof questionSchema>
export type JudgmentRow = z.infer<typeof judgmentSchema>
export type DiscoveryRow = z.infer<typeof discoverySchema>
export type CaptureRow = z.infer<typeof captureSchema>
export type Regression = z.infer<typeof regressionSchema>
export type EvalPresentation = z.infer<typeof evalSchema>
export type Action = z.infer<typeof actionSchema>
export type Provenance = z.infer<typeof provenanceSchema>
export type AttemptIndexEntry = z.infer<typeof attemptIndexSchema>
export type RunPresentation = z.infer<typeof runPresentationSchema>

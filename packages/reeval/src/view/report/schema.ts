import { z } from 'zod'
import { type Assert, dataProblem, type Same } from '../../contract/shared.ts'
import type { AttemptFacts } from '../classify.ts'
import { fillDefaults, MIGRATIONS, NewerSchemaError } from '../record.ts'
import { REPORT_VERSION } from './split.ts'
import type {
  Arm,
  ArmRef,
  ArmRow,
  AssertionRow,
  AttemptIndexRow,
  AttemptRef,
  BehaviorRow,
  BreakdownRow,
  CaptureGallery,
  CaptureShot,
  ChangeRow,
  CheckCell,
  ChoiceBreakdown,
  ContrastRow,
  Count,
  Delta,
  DiscoveryRate,
  EffortPivotRow,
  EvalHeadline,
  EvalSection,
  ExecutiveRollup,
  FailureCluster,
  FailureClusters,
  Figure,
  HeadlinePrimary,
  HeadlineResult,
  IntegrityIssue,
  Interval,
  JudgeRow,
  JudgeScore,
  JudgmentBreakdown,
  MeasureCells,
  MeasureVsBaseline,
  PairwiseRow,
  Proportion,
  ProvenanceState,
  QualitativeAnswers,
  Quote,
  Rate,
  RegressionChanges,
  ReportClaim,
  RosterRow,
  RunHeader,
  RunReport,
  RunTally,
  Spread,
  TaskCell,
  TaskResults,
  TaskRow,
  VariantComparison,
} from './types.ts'

const figureSchema: z.ZodType<Figure> = z.strictObject({
  value: z.number().nullable(),
  text: z.string(),
})

const deltaSchema: z.ZodType<Delta> = z.strictObject({
  value: z.number().nullable(),
  unit: z.enum(['pct', 'pts']),
  text: z.string(),
})

const intervalSchema: z.ZodType<Interval> = z.strictObject({
  lo: z.number(),
  hi: z.number(),
  text: z.string(),
})

const spreadSchema: z.ZodType<Spread> = z.strictObject({
  n: z.number().int().nonnegative(),
  median: figureSchema,
  q1: figureSchema,
  q3: figureSchema,
})

const countSchema: z.ZodType<Count> = z.strictObject({
  k: z.number().int().nonnegative(),
  n: z.number().int().nonnegative(),
  text: z.string(),
})

const rateSchema: z.ZodType<Rate> = z.strictObject({
  k: z.number().int().nonnegative(),
  n: z.number().int().nonnegative(),
  rate: z.number().nullable(),
  text: z.string(),
  interval: intervalSchema.nullable(),
})

const proportionSchema: z.ZodType<Proportion> = z.strictObject({
  k: z.number().int().nonnegative(),
  n: z.number().int().nonnegative(),
})

const attemptRefSchema: z.ZodType<AttemptRef> = z.strictObject({
  id: z.string(),
  key: z.string(),
  href: z.string(),
})

const armRefSchema: z.ZodType<ArmRef> = z.strictObject({
  id: z.string(),
  label: z.string(),
})

const measureKeySchema = z.enum([
  'tokens',
  'toolCalls',
  'turns',
  'costUsd',
  'agentMs',
  'filesChanged',
  'linesAdded',
  'linesRemoved',
])

const measureUnitSchema = z.enum(['tokens', 'ms', 'usd', 'count', 'lines', 'files'])

const measureCellsSchema: z.ZodType<MeasureCells> = z.strictObject({
  tokens: spreadSchema.nullable(),
  toolCalls: spreadSchema.nullable(),
  turns: spreadSchema.nullable(),
  costUsd: spreadSchema.nullable(),
  agentMs: spreadSchema.nullable(),
  filesChanged: spreadSchema.nullable(),
  linesAdded: spreadSchema.nullable(),
  linesRemoved: spreadSchema.nullable(),
})

const quoteSchema: z.ZodType<Quote> = z.strictObject({
  text: z.string(),
  attempt: attemptRefSchema,
  harness: z.string(),
  arm: z.string().nullable(),
  case: z.string().nullable(),
  input: z.string().nullable(),
})

const passMetricLeadSchema = z.enum(['pass-rate', 'task-pass-rate', 'pass@k', 'pass^k'])
const explicitKSchema = z.number().int().min(2)

const otherVariantSchema = z.strictObject({
  variant: armRefSchema,
  points: deltaSchema,
  interval: intervalSchema,
  rate: rateSchema,
  taskRate: figureSchema.optional(),
  taskPoints: deltaSchema.optional(),
  k: explicitKSchema.optional(),
  passAtK: figureSchema.optional(),
  passHatK: figureSchema.optional(),
  passKOmitted: z.string().optional(),
})

const tiedLeadSchema = z.strictObject({
  measure: measureKeySchema,
  baseline: figureSchema,
  variant: figureSchema,
  delta: deltaSchema,
})

const compareStatusSchema = z.enum([
  'regressed',
  'fixed',
  'same',
  'gate',
  'drift',
  'added',
  'removed',
  'infra',
])

const changeRowSchema: z.ZodType<ChangeRow> = z.strictObject({
  signal: z.string(),
  kind: z.enum(['outcome', 'assertion', 'judgment', 'choice', 'measure', 'observation']),
  harness: z.string().nullable(),
  prior: z.string(),
  current: z.string(),
  priorPassed: proportionSchema.nullable().optional(),
  currentPassed: proportionSchema.nullable().optional(),
  delta: deltaSchema.nullable(),
  status: compareStatusSchema,
  gate: z.boolean(),
})

export const headlinePrimarySchema: z.ZodType<HeadlinePrimary> = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('pass-rate'),
    rate: rateSchema,
    taskRate: figureSchema.optional(),
    tasks: z.number().int().min(2).optional(),
    assertions: z.number().int().positive(),
    harnesses: z.number().int().positive(),
    outcome: z.enum(['passed', 'found', 'used']),
    metric: passMetricLeadSchema.optional(),
    k: explicitKSchema.optional(),
    passAtK: figureSchema.optional(),
    passHatK: figureSchema.optional(),
    passKOmitted: z.string().optional(),
  }),
  z.strictObject({
    kind: z.literal('lift'),
    baseline: armRefSchema,
    variant: armRefSchema,
    points: deltaSchema,
    interval: intervalSchema,
    baselineRate: rateSchema,
    variantRate: rateSchema,
    baselineTaskRate: figureSchema.optional(),
    variantTaskRate: figureSchema.optional(),
    taskPoints: deltaSchema.optional(),
    tasks: z.number().int().min(2).optional(),
    metric: passMetricLeadSchema.optional(),
    k: explicitKSchema.optional(),
    baselinePassAtK: figureSchema.optional(),
    variantPassAtK: figureSchema.optional(),
    passAtKPoints: deltaSchema.optional(),
    baselinePassHatK: figureSchema.optional(),
    variantPassHatK: figureSchema.optional(),
    passHatKPoints: deltaSchema.optional(),
    passKOmitted: z.string().optional(),
    saturated: z.boolean().optional(),
    others: z.array(otherVariantSchema),
  }),
  z.strictObject({
    kind: z.literal('tied-ceiling'),
    baseline: armRefSchema,
    variant: armRefSchema,
    rate: rateSchema,
    taskRate: figureSchema.optional(),
    tasks: z.number().int().min(2).optional(),
    assertions: z.number().int().positive(),
    lead: tiedLeadSchema,
    metric: passMetricLeadSchema.optional(),
    k: explicitKSchema.optional(),
    passAtK: figureSchema.optional(),
    passHatK: figureSchema.optional(),
    passKOmitted: z.string().optional(),
    saturated: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal('choice'),
    question: z.string(),
    options: z
      .array(z.strictObject({ label: z.string(), count: z.number().int().nonnegative() }))
      .min(2),
    attempts: z.number().int().positive(),
    noPick: z.number().int().nonnegative(),
  }),
  z.strictObject({
    kind: z.literal('measure'),
    label: z.string(),
    unit: measureUnitSchema,
    spread: spreadSchema,
  }),
  z.strictObject({
    kind: z.literal('judge'),
    label: z.string(),
    question: z.string(),
    scale: z.tuple([z.number(), z.number()]),
    threshold: z.number().nullable(),
    spread: spreadSchema,
    atOrAbove: countSchema.nullable(),
  }),
  z.strictObject({
    kind: z.literal('text'),
    question: z.string(),
    answered: countSchema,
    lead: quoteSchema.nullable(),
    leadRole: z.enum(['sole', 'representative']).nullable(),
  }),
  z.strictObject({
    kind: z.literal('regression'),
    worse: z.number().int().nonnegative(),
    fixed: z.number().int().nonnegative(),
    lead: changeRowSchema.nullable(),
  }),
])

const headlineResultSchema: z.ZodType<HeadlineResult> = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('pass-rate'),
    passed: proportionSchema,
    outcome: z.enum(['passed', 'found', 'used']),
    taskRate: z.number().optional(),
    metric: passMetricLeadSchema.optional(),
    k: explicitKSchema.optional(),
    passAtK: z.number().optional(),
    passHatK: z.number().optional(),
  }),
  z.strictObject({
    kind: z.literal('lift'),
    baseline: z.string(),
    variant: z.string(),
    baselinePassed: proportionSchema,
    variantPassed: proportionSchema,
    baselineTaskRate: z.number().optional(),
    variantTaskRate: z.number().optional(),
    points: z.number(),
    lo: z.number(),
    hi: z.number(),
    metric: passMetricLeadSchema.optional(),
    k: explicitKSchema.optional(),
    baselinePassAtK: z.number().optional(),
    variantPassAtK: z.number().optional(),
    baselinePassHatK: z.number().optional(),
    variantPassHatK: z.number().optional(),
    saturated: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal('tied-ceiling'),
    baseline: z.string(),
    variant: z.string(),
    passed: proportionSchema,
    measure: measureKeySchema,
    baselineMedian: z.number(),
    variantMedian: z.number(),
    metric: passMetricLeadSchema.optional(),
    k: explicitKSchema.optional(),
    passAtK: z.number().optional(),
    passHatK: z.number().optional(),
    saturated: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal('choice'),
    question: z.string(),
    options: z.array(z.strictObject({ label: z.string(), count: z.number().int().nonnegative() })),
    attempts: z.number().int().nonnegative(),
  }),
  z.strictObject({
    kind: z.literal('measure'),
    label: z.string(),
    unit: measureUnitSchema,
    median: z.number().nullable(),
    n: z.number().int().nonnegative(),
  }),
  z.strictObject({
    kind: z.literal('judge'),
    label: z.string(),
    scale: z.tuple([z.number(), z.number()]),
    median: z.number().nullable(),
    n: z.number().int().nonnegative(),
  }),
  z.strictObject({
    kind: z.literal('text'),
    question: z.string(),
    answered: proportionSchema,
  }),
  z.strictObject({
    kind: z.literal('regression'),
    worse: z.number().int().nonnegative(),
    fixed: z.number().int().nonnegative(),
    lead: changeRowSchema.nullable(),
  }),
])

const fairnessSchema = z.enum(['clear', 'within-noise', 'too-few-runs'])
const evalShapeSchema = z.enum(['task', 'ab', 'discoverability', 'regression'])

const evalHeadlineSchema: z.ZodType<EvalHeadline> = z.strictObject({
  task: z.string(),
  kicker: z.string().nullable(),
  fairness: fairnessSchema,
  primary: headlinePrimarySchema,
  foot: z.string(),
  saturated: z.boolean().optional(),
})

const checkCellSchema: z.ZodType<CheckCell> = z.strictObject({
  status: z.enum(['pass', 'fail', 'mixed', 'na', 'error', 'not-run']),
  passed: z.number().int().nonnegative(),
  answered: z.number().int().nonnegative(),
  notApplicable: z.number().int().nonnegative(),
  preSatisfied: z.number().int().nonnegative(),
  text: z.string(),
  reason: z.string().nullable(),
})

const assertionRowSchema: z.ZodType<AssertionRow> = z.strictObject({
  label: z.string(),
  matcher: z.string(),
  at: z.string().nullable(),
  cells: z.record(z.string(), checkCellSchema),
  total: checkCellSchema,
})

const taskCellSchema: z.ZodType<TaskCell> = z.strictObject({
  rate: rateSchema,
  k: explicitKSchema.optional(),
  passAtK: figureSchema.optional(),
  passHatK: figureSchema.optional(),
  passKOmitted: z.string().optional(),
})

const taskRowSchema: z.ZodType<TaskRow> = z.strictObject({
  task: z.string(),
  label: z.string(),
  cells: z.record(z.string(), taskCellSchema),
  total: taskCellSchema.nullable(),
})

const breakdownRowSchema: z.ZodType<BreakdownRow> = z.strictObject({
  keys: z.array(z.string()),
  rate: rateSchema.nullable(),
  taskRate: figureSchema.nullable().optional(),
  k: explicitKSchema.optional(),
  passAtK: figureSchema.optional(),
  passHatK: figureSchema.optional(),
  passKOmitted: z.string().optional(),
  measures: measureCellsSchema,
  costPerSuccess: figureSchema.nullable().optional(),
})

const taskResultsSchema = z.strictObject({
  kind: z.literal('task'),
  columns: z.array(z.string()),
  assertions: z.array(assertionRowSchema),
  axes: z.array(z.string()),
  breakdown: z.array(breakdownRowSchema),
  median: breakdownRowSchema.nullable(),
  metric: passMetricLeadSchema.optional(),
  k: explicitKSchema.optional(),
  passAtK: figureSchema.optional(),
  passHatK: figureSchema.optional(),
  passKOmitted: z.string().optional(),
  costReported: z.boolean().optional(),
  tasks: z.array(taskRowSchema).optional(),
})

const armSchema: z.ZodType<Arm> = z.strictObject({
  id: z.string(),
  label: z.string(),
  environment: z.string(),
  environmentDigest: z.string().nullable(),
  role: z.enum(['baseline', 'variant']),
  change: z.string().nullable(),
  prompts: z.array(z.string()),
  gated: z.boolean().optional(),
})

const measureVsBaselineSchema: z.ZodType<MeasureVsBaseline> = z.strictObject({
  value: spreadSchema.nullable(),
  delta: deltaSchema.nullable(),
  lower: countSchema.nullable(),
})

const measureVsBaselineRecordSchema: z.ZodType<
  Record<z.infer<typeof measureKeySchema>, MeasureVsBaseline>
> = z.strictObject({
  tokens: measureVsBaselineSchema,
  toolCalls: measureVsBaselineSchema,
  turns: measureVsBaselineSchema,
  costUsd: measureVsBaselineSchema,
  agentMs: measureVsBaselineSchema,
  filesChanged: measureVsBaselineSchema,
  linesAdded: measureVsBaselineSchema,
  linesRemoved: measureVsBaselineSchema,
})

const armRowSchema: z.ZodType<ArmRow> = z.strictObject({
  arm: z.string(),
  rate: rateSchema,
  taskRate: figureSchema.optional(),
  taskLift: deltaSchema.nullable().optional(),
  k: explicitKSchema.optional(),
  passAtK: figureSchema.optional(),
  passHatK: figureSchema.optional(),
  passKOmitted: z.string().optional(),
  missedMinLift: z.number().optional(),
  lift: deltaSchema.nullable(),
  interval: intervalSchema.nullable(),
  verdict: z.enum(['baseline', 'helped', 'made-worse', 'within-noise', 'too-few-runs']),
  verdictScope: z.literal('pass-rate'),
  measures: measureVsBaselineRecordSchema,
  costPerSuccess: figureSchema.nullable().optional(),
  costPerSuccessDelta: deltaSchema.nullable().optional(),
})

const effortPivotRowSchema: z.ZodType<EffortPivotRow> = z.strictObject({
  harness: z.string(),
  arm: z.string(),
  rate: rateSchema,
  taskRate: figureSchema.optional(),
  k: explicitKSchema.optional(),
  passAtK: figureSchema.optional(),
  passHatK: figureSchema.optional(),
  passKOmitted: z.string().optional(),
  measures: measureVsBaselineRecordSchema,
  costPerSuccess: figureSchema.nullable().optional(),
  costPerSuccessDelta: deltaSchema.nullable().optional(),
})

const behaviorRowSchema: z.ZodType<BehaviorRow> = z.strictObject({
  label: z.string(),
  matcher: z.string(),
  cells: z.record(z.string(), countSchema.nullable()),
})

const contrastRowSchema: z.ZodType<ContrastRow> = z.strictObject({
  from: z.string(),
  to: z.string(),
  harness: z.string().optional(),
  sandbox: z.string().optional(),
  fromPassed: proportionSchema.optional(),
  toPassed: proportionSchema.optional(),
  taskDelta: deltaSchema.optional(),
  brokenTasks: z.array(z.string()).optional(),
  measure: z.union([z.literal('pass-rate'), measureKeySchema]),
  delta: deltaSchema,
  interval: intervalSchema.nullable(),
  verdict: z.enum(['helped', 'made-worse', 'within-noise', 'too-few-runs', 'fewer', 'more']),
  verdictScope: z.enum(['pass-rate', 'measure']),
})

const variantComparisonSchema = z.strictObject({
  kind: z.literal('comparison'),
  arms: z.array(armSchema),
  uniformLead: z.string().nullable(),
  metric: passMetricLeadSchema.optional(),
  k: explicitKSchema.optional(),
  costReported: z.boolean().optional(),
  saturated: z.boolean().optional(),
  saturationNote: z.string().nullable().optional(),
  summary: z.array(armRowSchema),
  tasks: z.array(taskRowSchema).optional(),
  assertionsByArm: z.array(assertionRowSchema),
  behavior: z.array(behaviorRowSchema),
  contrasts: z.array(contrastRowSchema),
  effortByHarness: z.array(effortPivotRowSchema),
})

const regressionChangesSchema = z.strictObject({
  kind: z.literal('regression'),
  baseRunId: z.string(),
  prior: z.strictObject({
    runId: z.string(),
    startedAt: z.string(),
    gitSha: z.string().nullable(),
    branch: z.string().nullable(),
    author: z.string(),
  }),
  whatChanged: z.array(z.string()),
  rows: z.array(changeRowSchema),
  unchanged: z.array(changeRowSchema),
})

const primaryBlockSchema = z.discriminatedUnion('kind', [
  taskResultsSchema,
  variantComparisonSchema,
  regressionChangesSchema,
]) as z.ZodType<TaskResults | VariantComparison | RegressionChanges>

const choiceBreakdownSchema: z.ZodType<ChoiceBreakdown> = z.strictObject({
  question: z.string(),
  options: z.array(z.strictObject({ label: z.string(), count: z.number().int().nonnegative() })),
  noPick: z.number().int().nonnegative(),
  rows: z.array(
    z.strictObject({
      arm: z.string().nullable(),
      prompt: z.string().nullable(),
      harness: z.string(),
      counts: z.record(z.string(), z.number().int().nonnegative()),
      attempts: z.number().int().nonnegative(),
      picks: z
        .array(
          z.strictObject({
            option: z.string(),
            k: z.number().int().nonnegative(),
            n: z.number().int().nonnegative(),
          }),
        )
        .optional(),
      text: z.string(),
    }),
  ),
  passByPick: z.array(z.strictObject({ option: z.string(), rate: rateSchema })),
})

const discoveryRateSchema: z.ZodType<DiscoveryRate> = z.strictObject({
  what: z.string(),
  matcher: z.string(),
  found: countSchema,
  rows: z.array(z.strictObject({ keys: z.array(z.string()), found: countSchema })),
  sources: z.array(
    z.strictObject({
      source: z.enum(['placed', 'skill-dir', 'elsewhere', 'mcp', 'web']),
      count: z.number().int().nonnegative(),
    }),
  ),
})

const indexOutcomeSchema = z.enum(['pass', 'fail', 'infra_error', 'canceled'])

const judgeScoreSchema: z.ZodType<JudgeScore> = z.strictObject({
  attempt: z.string(),
  key: z.string(),
  keys: z.array(z.string()),
  score: z.number(),
  verdict: z.enum(['pass', 'fail']),
  outcome: indexOutcomeSchema,
})

const judgeRowSchema: z.ZodType<JudgeRow> = z.strictObject({
  label: z.string(),
  question: z.string(),
  assertion: z.string().nullable(),
  threshold: z.number().nullable(),
  keys: z.array(z.string()),
  spread: spreadSchema,
  atOrAbove: countSchema.nullable(),
  scores: z.array(judgeScoreSchema).optional(),
})

const pairwiseRowSchema: z.ZodType<PairwiseRow> = z.strictObject({
  question: z.string(),
  cut: z.enum(['within', 'across']),
  a: z.string(),
  b: z.string(),
  aWins: z.number().int().nonnegative(),
  bWins: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  pairs: z.number().int().nonnegative(),
  reasons: z.array(
    z.strictObject({
      text: z.string(),
      cites: z.tuple([attemptRefSchema, attemptRefSchema]),
      input: z.string().nullable(),
    }),
  ),
})

const judgmentBreakdownSchema: z.ZodType<JudgmentBreakdown> = z.strictObject({
  axes: z.array(z.string()),
  scores: z.array(judgeRowSchema),
  pairwise: z.array(pairwiseRowSchema),
})

const qualitativeAnswersSchema: z.ZodType<QualitativeAnswers> = z.strictObject({
  question: z.string(),
  answered: countSchema,
  themes: z.array(z.strictObject({ title: z.string(), quotes: z.array(quoteSchema) })).nullable(),
  entries: z.array(quoteSchema),
})

const captureShotSchema: z.ZodType<CaptureShot> = z.strictObject({
  name: z.string(),
  href: z.string().nullable(),
  meta: z.string().nullable(),
  attempt: attemptRefSchema,
  status: z.number().nullable(),
  pageErrors: z.number().nullable(),
  consoleErrors: z.number().nullable(),
})

const captureGallerySchema: z.ZodType<CaptureGallery> = z.strictObject({
  rows: z.array(
    z.strictObject({
      harness: z.string(),
      arm: z.string().nullable(),
      case: z.string().nullable(),
      shots: z.array(captureShotSchema),
    }),
  ),
})

const failureClusterSchema: z.ZodType<FailureCluster> = z.strictObject({
  kind: z.enum(['assertion', 'turn-error', 'infra-error', 'capture-error', 'error']),
  cause: z.enum(['timeout', 'canceled']).optional(),
  label: z.string(),
  at: z.string().nullable(),
  message: z.string().optional(),
  detail: z.string().optional(),
  count: countSchema,
  attempts: z.array(attemptRefSchema),
})

const failureClustersSchema: z.ZodType<FailureClusters> = z.strictObject({
  clusters: z.array(failureClusterSchema),
  remarks: z.array(
    z.strictObject({
      kind: z.enum([
        'too-few-tries',
        'cant-tell-apart',
        'check-never-fails',
        'flaky-check',
        'slow-mcp-start',
        'proxy-only-egress',
        'setup-process-secret',
        'setup-tunnel-closed',
        'snapshot-too-large',
        'observe-throws',
      ]),
      severity: z.enum(['concern', 'suggestion']),
      text: z.string(),
      fix: z.strictObject({ at: z.string(), edit: z.string() }),
      line: z.string().optional(),
    }),
  ),
})

const reportClaimSchema: z.ZodType<ReportClaim> = z.strictObject({
  role: z.enum(['finding', 'caveat', 'action']),
  text: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  cites: z.array(attemptRefSchema),
  action: z
    .strictObject({
      kind: z.enum(['skill', 'docs', 'eval', 'judge', 'reeval', 'harness']),
      target: z.string(),
      change: z.string(),
      verify: z.string().nullable(),
    })
    .nullable(),
})

const evalSectionSchema = z.strictObject({
  id: z.string(),
  anchor: z.string(),
  name: z.string(),
  group: z.array(z.string()).optional(),
  state: z.enum(['ran', 'skipped', 'todo', 'not-run']).optional(),
  outcome: z.enum(['pass', 'fail', 'infra_error', 'skipped']).optional(),
  file: z.string(),
  shapes: z.array(evalShapeSchema),
  design: z.string(),
  headline: evalHeadlineSchema,
  insights: z.array(reportClaimSchema),
  primary: primaryBlockSchema.nullable(),
  choices: z.array(choiceBreakdownSchema),
  discovery: z.array(discoveryRateSchema),
  judgments: judgmentBreakdownSchema.nullable(),
  qualitative: z.array(qualitativeAnswersSchema),
  unanswered: z.array(z.strictObject({ question: z.string(), text: z.string() })).optional(),
  captures: captureGallerySchema.nullable(),
  failures: failureClustersSchema.nullable(),
  next: z
    .array(z.strictObject({ kind: z.string(), text: z.string(), at: z.string().nullable() }))
    .optional(),
  suggestions: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
  observed: z.array(z.string()).optional(),
}) as z.ZodType<EvalSection>

const runTallySchema: z.ZodType<RunTally> = z.strictObject({
  counted: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  ungated: z.strictObject({
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  infraError: z.number().int().nonnegative(),
  reclassified: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
})

const runHeaderSchema: z.ZodType<RunHeader> = z.strictObject({
  title: z.string(),
  status: z.enum(['complete', 'interrupted', 'budget']),
  startedAt: z.string(),
  author: z.string(),
  reeval: z.string(),
  profile: z.string().nullable(),
  scope: z
    .strictObject({
      profile: z.string().nullable(),
      subset: z.boolean(),
      configKey: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .optional(),
  runsPerCell: z.number().int().positive().nullable(),
  wall: figureSchema,
  tally: runTallySchema,
  tokens: z
    .strictObject({
      total: figureSchema,
      cacheRead: figureSchema,
    })
    .nullable(),
  cost: z
    .strictObject({
      agent: figureSchema.nullable(),
      judge: figureSchema.nullable(),
      total: figureSchema.nullable(),
      basis: z.enum(['reported', 'estimated', 'mixed']),
      unpriced: z.number().optional(),
    })
    .nullable(),
  git: z
    .strictObject({
      sha: z.string(),
      branch: z.string().nullable(),
      dirty: z.boolean(),
      repo: z.string().nullable(),
    })
    .nullable(),
  servedBy: z.array(z.strictObject({ harness: z.string(), text: z.string() })).optional(),
  errors: z.array(z.string()).optional(),
})

const integrityIssueSchema: z.ZodType<IntegrityIssue> = z.strictObject({
  kind: z.enum([
    'run-incomplete',
    'turn-error',
    'pre-satisfied',
    'fairness-floor',
    'served-model-drift',
    'unreported-usage',
    'prompt-confounded',
    'duplicate-environment',
    'baseline-never-passes',
    'dirty-worktree',
  ]),
  severity: z.enum(['error', 'warn']),
  text: z.string(),
  evalId: z.string().nullable(),
  cites: z.array(attemptRefSchema),
})

const executiveRollupSchema: z.ZodType<ExecutiveRollup> = z.strictObject({
  lead: reportClaimSchema.nullable(),
  rows: z.array(
    z.strictObject({
      evalId: z.string(),
      name: z.string(),
      anchor: z.string(),
      shapes: z.array(evalShapeSchema),
      design: z.string(),
      primary: z.string(),
      result: headlineResultSchema.optional(),
      medianTokens: figureSchema,
      medianTokensByArm: z
        .array(z.strictObject({ arm: z.string(), tokens: figureSchema }))
        .optional(),
    }),
  ),
  findings: z.array(reportClaimSchema),
})

const rosterRowSchema: z.ZodType<RosterRow> = z.strictObject({
  harness: z.string(),
  model: z.string().nullable(),
  effort: z.string().nullable(),
  servedModels: z.array(z.string()),
  gateway: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
})

const provenanceStateSchema: z.ZodType<ProvenanceState> = z.strictObject({
  rows: z.array(z.strictObject({ field: z.string(), value: z.string() })),
  context: z.strictObject({
    count: z.number().int().nonnegative(),
    files: z.array(z.strictObject({ path: z.string(), sha256: z.string() })),
  }),
  artifacts: z.enum(['all', 'evidence', 'failures', 'none']),
  record: z.string(),
  warnings: z.array(z.string()),
})

const attemptFactsSchema: z.ZodType<AttemptFacts> = z.strictObject({
  toolCalls: z.number().int().nonnegative(),
  byClass: z.strictObject({
    context: z.number().int().nonnegative(),
    dependency: z.number().int().nonnegative(),
    web: z.number().int().nonnegative(),
    verify: z.number().int().nonnegative(),
    workspace: z.number().int().nonnegative(),
  }),
  skills: z.array(
    z.strictObject({
      skill: z.string(),
      source: z.enum(['placed', 'skill-dir', 'elsewhere']),
      reads: z.number().int().positive(),
      firstLine: z.number().int().positive(),
    }),
  ),
  contextFiles: z.array(
    z.strictObject({
      path: z.string(),
      reads: z.number().int().positive(),
      firstLine: z.number().int().positive(),
    }),
  ),
})

const attemptIndexRowSchema: z.ZodType<AttemptIndexRow> = z.strictObject({
  id: z.string(),
  key: z.string(),
  evalId: z.string(),
  harness: z.string(),
  arm: z.string().nullable(),
  case: z.string().nullable(),
  outcome: indexOutcomeSchema,
  reclassified: z.boolean(),
  turnError: z.string().nullable(),
  gated: z.boolean().optional(),
  failed: z
    .array(z.strictObject({ label: z.string(), at: z.string().nullable(), message: z.string() }))
    .optional(),
  error: z
    .strictObject({
      kind: z.enum(['assertion', 'timeout', 'aborted', 'infra', 'judge']),
      message: z.string(),
    })
    .nullable()
    .optional(),
  cost: z
    .strictObject({
      usd: z.number().nonnegative(),
      text: z.string(),
      basis: z.enum(['reported', 'estimated']),
    })
    .nullable()
    .optional(),
  answers: z
    .array(
      z.strictObject({
        question: z.string(),
        model: z.string(),
        choice: z.string().nullable(),
        text: z.string(),
        error: z.string().nullable(),
      }),
    )
    .optional(),
  tokens: figureSchema,
  agentMs: figureSchema,
  toolCalls: figureSchema,
  usage: z
    .strictObject({
      input: z.number().nonnegative(),
      output: z.number().nonnegative(),
      cacheRead: z.number().nonnegative(),
      cacheWrite: z.number().nonnegative(),
      reasoning: z.number().nonnegative().nullable(),
    })
    .nullable()
    .optional(),
  time: z
    .strictObject({
      setupMs: z.number().nonnegative(),
      agentMs: z.number().nonnegative(),
      diffMs: z.number().nonnegative(),
      checksMs: z.number().nonnegative(),
      judgeMs: z.number().nonnegative(),
      agent: z
        .strictObject({
          modelMs: z.number().nonnegative().nullable(),
          toolMs: z.number().nonnegative(),
          waitingMs: z.number().nonnegative(),
          otherMs: z.number().nonnegative(),
        })
        .nullable(),
    })
    .optional(),
  judgments: z
    .array(
      z.strictObject({
        label: z.string(),
        score: z.number(),
        threshold: z.number(),
        verdict: z.enum(['pass', 'fail']),
        gated: z.boolean(),
      }),
    )
    .optional(),
  facts: attemptFactsSchema.optional(),
  diff: z
    .strictObject({
      files: z.number().int().nonnegative(),
      added: z.number().int().nullable(),
      removed: z.number().int().nullable(),
      text: z.string(),
    })
    .nullable(),
  links: z.strictObject({
    transcript: z.string().nullable(),
    diff: z.string().nullable(),
    captures: z.array(z.strictObject({ name: z.string(), href: z.string() })),
    questions: z.array(z.string()),
    snapshot: z.string().optional(),
  }),
  href: z.string(),
})

export const runReportSchema: z.ZodType<RunReport> = z.strictObject({
  reportVersion: z.literal(1),
  runId: z.string(),
  single: z.boolean(),
  header: runHeaderSchema,
  integrity: z.array(integrityIssueSchema),
  rollup: executiveRollupSchema.nullable(),
  roster: z.array(rosterRowSchema),
  evals: z.array(evalSectionSchema).min(1, 'must hold at least one eval'),
  actions: z.array(reportClaimSchema),
  provenance: provenanceStateSchema,
  attempts: z.array(attemptIndexRowSchema),
})

export type _SameAsSchema = [
  Assert<Same<z.infer<typeof figureSchema>, Figure>>,
  Assert<Same<z.infer<typeof deltaSchema>, Delta>>,
  Assert<Same<z.infer<typeof intervalSchema>, Interval>>,
  Assert<Same<z.infer<typeof spreadSchema>, Spread>>,
  Assert<Same<z.infer<typeof countSchema>, Count>>,
  Assert<Same<z.infer<typeof rateSchema>, Rate>>,
  Assert<Same<z.infer<typeof headlinePrimarySchema>, HeadlinePrimary>>,
  Assert<Same<z.infer<typeof headlineResultSchema>, HeadlineResult>>,
  Assert<Same<z.infer<typeof judgeScoreSchema>, JudgeScore>>,
  Assert<Same<z.infer<typeof proportionSchema>, Proportion>>,
  Assert<Same<z.infer<typeof taskCellSchema>, TaskCell>>,
  Assert<Same<z.infer<typeof taskRowSchema>, TaskRow>>,
  Assert<Same<z.infer<typeof taskResultsSchema>, TaskResults>>,
  Assert<Same<z.infer<typeof variantComparisonSchema>, VariantComparison>>,
  Assert<Same<z.infer<typeof regressionChangesSchema>, RegressionChanges>>,
  Assert<Same<z.infer<typeof evalSectionSchema>, EvalSection>>,
  Assert<Same<z.infer<typeof runReportSchema>, RunReport>>,
]

export {
  attemptRefSchema,
  countSchema,
  deltaSchema,
  figureSchema,
  intervalSchema,
  rateSchema,
  reportClaimSchema,
  spreadSchema,
}

/**
 * Each named schema by the type in `./types.ts` it validates: the `$defs` of `report.json`'s JSON
 * Schema snapshot (`pnpm schema:update`), which takes each def's descriptions from that type.
 */
export const REPORT_SCHEMAS: Record<string, z.ZodType> = {
  Arm: armSchema,
  ArmRef: armRefSchema,
  ArmRow: armRowSchema,
  AssertionRow: assertionRowSchema,
  AttemptFacts: attemptFactsSchema,
  AttemptIndexRow: attemptIndexRowSchema,
  AttemptRef: attemptRefSchema,
  BehaviorRow: behaviorRowSchema,
  BreakdownRow: breakdownRowSchema,
  CaptureGallery: captureGallerySchema,
  CaptureShot: captureShotSchema,
  ChangeRow: changeRowSchema,
  CheckCell: checkCellSchema,
  ChoiceBreakdown: choiceBreakdownSchema,
  ContrastRow: contrastRowSchema,
  Count: countSchema,
  Delta: deltaSchema,
  DiscoveryRate: discoveryRateSchema,
  EffortPivotRow: effortPivotRowSchema,
  EvalHeadline: evalHeadlineSchema,
  EvalSection: evalSectionSchema,
  ExecutiveRollup: executiveRollupSchema,
  FailureCluster: failureClusterSchema,
  FailureClusters: failureClustersSchema,
  Figure: figureSchema,
  HeadlinePrimary: headlinePrimarySchema,
  IntegrityIssue: integrityIssueSchema,
  Interval: intervalSchema,
  JudgeRow: judgeRowSchema,
  JudgeScore: judgeScoreSchema,
  JudgmentBreakdown: judgmentBreakdownSchema,
  MeasureCells: measureCellsSchema,
  MeasureVsBaseline: measureVsBaselineSchema,
  PairwiseRow: pairwiseRowSchema,
  Proportion: proportionSchema,
  ProvenanceState: provenanceStateSchema,
  QualitativeAnswers: qualitativeAnswersSchema,
  Quote: quoteSchema,
  Rate: rateSchema,
  RegressionChanges: regressionChangesSchema,
  ReportClaim: reportClaimSchema,
  RosterRow: rosterRowSchema,
  RunHeader: runHeaderSchema,
  RunReport: runReportSchema,
  RunTally: runTallySchema,
  Spread: spreadSchema,
  TaskCell: taskCellSchema,
  TaskResults: taskResultsSchema,
  TaskRow: taskRowSchema,
  VariantComparison: variantComparisonSchema,
}

const LEAVES = new Set(['string', 'number', 'boolean', 'literal', 'enum', 'null', 'unknown'])
const loosened = new WeakMap<z.ZodType, z.ZodType>()

/**
 * `schema` with every object in it, at any depth, accepting keys it doesn't list (kept, not
 * stripped). Each node is a clone of the strict one with only its children and `catchall`
 * replaced, so checks such as `.min(1)` hold in both.
 */
function loose<T extends z.ZodType>(schema: T): T {
  const known = loosened.get(schema)
  if (known) return known as T
  // biome-ignore lint/suspicious/noExplicitAny: each case reads its own kind's def
  const def = schema.def as any
  let out: z.ZodType
  switch (def.type) {
    case 'object':
      out = schema.clone({
        ...def,
        shape: Object.fromEntries(
          Object.entries(def.shape as Record<string, z.ZodType>).map(([k, v]) => [k, loose(v)]),
        ),
        catchall: z.unknown(),
      })
      break
    case 'array':
      out = schema.clone({ ...def, element: loose(def.element) })
      break
    case 'nullable':
    case 'optional':
      out = schema.clone({ ...def, innerType: loose(def.innerType) })
      break
    case 'union':
      out = schema.clone({ ...def, options: def.options.map(loose) })
      break
    case 'tuple':
      out = schema.clone({ ...def, items: def.items.map(loose), rest: def.rest && loose(def.rest) })
      break
    case 'record':
      out = schema.clone({ ...def, valueType: loose(def.valueType) })
      break
    default:
      if (!LEAVES.has(def.type)) throw new Error(`loose(): no rule for a Zod ${def.type} schema`)
      out = schema
  }
  loosened.set(schema, out)
  return out as T
}

/** `runReportSchema` with unknown fields allowed at every level, for reading a stored report. */
export const looseRunReportSchema: z.ZodType<RunReport> = loose(runReportSchema)

/**
 * A stored `report.json` as a reader sees it: migrated to this reeval's `reportVersion`, each field
 * added after it was written read as its default (`READ_DEFAULTS['run-report']`), and fields a
 * newer reeval added, at any depth, passed through. A missing or mistyped field throws one sentence
 * naming it (`This report's header.title is missing: …`), and a `reportVersion` above this reeval's
 * a `NewerSchemaError`.
 */
export function readableRunReport(value: unknown, what = 'This report'): RunReport {
  let version = (value as { reportVersion?: unknown } | null)?.reportVersion
  if (typeof version === 'number' && version > REPORT_VERSION) {
    throw new NewerSchemaError(what, version, REPORT_VERSION, 'reportVersion')
  }
  let v = value
  for (; typeof version === 'number' && version < REPORT_VERSION; version++) {
    const migrate = MIGRATIONS['run-report']?.[version]
    if (!migrate) break
    v = migrate(v as never)
  }
  const filled = fillDefaults('run-report', v)
  const parsed = looseRunReportSchema.safeParse(filled)
  if (parsed.success) return parsed.data
  throw new Error(dataProblem(looseRunReportSchema, filled, what, () => []))
}

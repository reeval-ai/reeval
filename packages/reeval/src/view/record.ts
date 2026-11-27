// How a file reeval wrote earlier (or later) reads in this reeval. Browser-safe. Every reader of a run
// record, trajectory line, analysis document, note and remarks file goes through here, and `pnpm schema:check` holds
// the types to it: a field added as required needs a read default below, or a schemaVersion bump
// with a migration.

import type { ArchiveManifest } from '../archive/types.ts'
import type { BundleManifest } from '../bundle/types.ts'
import { foldCases } from '../history/cases.ts'
import type { ExecLine, RegradeRecord, RunRecord, WorkspaceManifest } from '../history/types.ts'
import { SCHEMA_VERSION } from '../history/types.ts'
import type { CredentialsFile } from '../login/types.ts'
import type { CliInvocation } from '../report/types.ts'
import { targetOfGates } from '../target.ts'
import type { CapturePageFile, DecisionRecord } from '../types.ts'
import type { AnalysisDoc } from './analysis.ts'
import { meanScores, scoresOf, targetCells } from './gate.ts'
import type { TrajectoryLine } from './model.ts'
import type { RunRemarks } from './remarks.ts'

/** Each shape reeval persists and reads back; `schema/<name>.schema.json` is its snapshot. */
export type ShapeName =
  | 'run-record'
  | 'trajectory-line'
  | 'analysis'
  | 'analysis-note'
  | 'remarks'
  | 'debug-request'
  | 'live-progress'
  | 'cloud-origin'
  | 'cli-invocation'
  | 'capture-page'
  | 'run-events'
  | 'bundle-manifest'
  | 'archive-manifest'
  | 'credentials'
  | 'run-report'
  | 'run-span'
  | 'exec-line'
  | 'decision-line'
  | 'workspace-manifest'
  | 'regrade'

/**
 * A field added after files were written without it, and what it reads as there. The path is
 * dotted, `[]` walks an array's items, `{}` a record's values and `<type=tool>` picks one variant
 * of a union, e.g. `evals[].trials[].egress` or `<type=tool>.ok`.
 */
export type ReadDefault = { path: string; empty: () => unknown }

export const READ_DEFAULTS: Record<ShapeName, ReadDefault[]> = {
  'run-record': [
    { path: 'plan.sandboxWarnings', empty: () => [] },
    { path: 'stack.harnesses[].resolvedModels', empty: () => [] },
    { path: 'stack.harnesses[].effort', empty: () => null },
    { path: 'stack.harnesses[].resolvedEffort', empty: () => [] },
    { path: 'evals[].todo', empty: () => false },
    { path: 'evals[].cells[].effort', empty: () => null },
    { path: 'evals[].trials[].effort', empty: () => null },
    { path: 'evals[].trials[].servedEffort', empty: () => null },
    { path: 'evals[].trials[].activity.stalledTools', empty: () => 0 },
    { path: 'evals[].trials[].activity.maxToolMs', empty: () => null },
    { path: 'evals[].trials[].activity.llmCalls', empty: () => null },
    { path: 'evals[].trials[].egress.unresolved', empty: () => [] },
    { path: 'evals[].cells[].checks[].notApplicable', empty: () => 0 },
    { path: 'evals[].cases[].cells[].checks[].notApplicable', empty: () => 0 },
    { path: 'evals[].cases[].cells[].checks[].baseline.notApplicable', empty: () => 0 },
    { path: 'evals[].cells[].checks[].baseline.notApplicable', empty: () => 0 },
  ],
  'trajectory-line': [],
  analysis: [],
  'analysis-note': [],
  remarks: [],
  'debug-request': [],
  'live-progress': [],
  'cloud-origin': [],
  'cli-invocation': [],
  'capture-page': [],
  'run-events': [
    { path: 'record.evals[].cells[].checks[].notApplicable', empty: () => 0 },
    { path: 'record.evals[].cases[].cells[].checks[].notApplicable', empty: () => 0 },
    { path: 'record.evals[].cases[].cells[].checks[].baseline.notApplicable', empty: () => 0 },
    { path: 'record.evals[].cells[].checks[].baseline.notApplicable', empty: () => 0 },
    { path: 'record.evals[].trials[].activity.llmCalls', empty: () => null },
  ],
  'bundle-manifest': [],
  'archive-manifest': [],
  credentials: [],
  'run-report': [],
  'run-span': [],
  'exec-line': [],
  'decision-line': [],
  'workspace-manifest': [],
  regrade: [],
}

/**
 * Turns a file at schemaVersion `n` into one at `n + 1`, keyed by `n`. A change that can't be a new
 * optional field or a read default bumps the shape's schemaVersion and adds one here.
 */
export const MIGRATIONS: Partial<Record<ShapeName, Record<number, (value: never) => unknown>>> = {
  // Record and event-stream version 2, and report version 4, call the agent's event log its
  // trajectory: each `transcript` field is `trajectory`.
  'run-record': {
    1: (record: object) => recordV2(record),
    // Version 3 renamed attempts to trials, a cell's runs to its trials, the control to the
    // baseline and an arm to an environment.
    2: (record: object) => recordV3(record),
  },
  'run-events': {
    1: (line: Obj) => {
      renamed(line, EVENTS_TRAJECTORY, trajectoryKey)
      if (line.type === 'header' && line.schemaVersion === 1) line.schemaVersion = 2
      if (line.type === 'run-end' && isObject(line.record) && line.record.schemaVersion === 1) {
        line.record = recordV2(line.record)
      }
      return line
    },
    // Version 3 renamed attempts to trials, a cell's runs to its trials, the control to the
    // baseline and an arm to an environment, in the stream and its run-end record.
    2: (line: Obj) => {
      renamed(line, EVENTS_TRIALS, trialKey)
      for (const t of EVENTS_TRIAL) {
        visit(line, `${t}.trial.plan`.split('.'), (parent, key) => {
          const plan = parent[key]
          if (isObject(plan) && 'attempts' in plan) {
            plan.totalTrials = plan.attempts
            delete plan.attempts
          }
        })
      }
      revalued(
        line,
        EVENTS_TRIAL.map((t) => `${t}.trial.cell.role`),
      )
      if (line.type === 'run-end' && isObject(line.remarks) && line.remarks.schemaVersion === 1) {
        line.remarks = remarksV2(line.remarks)
      }
      if (line.type === 'header' && line.schemaVersion === 2) line.schemaVersion = 3
      if (line.type === 'run-end' && isObject(line.record) && line.record.schemaVersion === 2) {
        line.record = recordV3(line.record)
      }
      return line
    },
  },
  // Report version 2 added grade kinds `judge` and `builtin`, and version 3 the `target`
  // headline; an older report reads as it is.
  'run-report': {
    1: (report: object) => ({ ...report, reportVersion: 2 }),
    2: (report: object) => ({ ...report, reportVersion: 3 }),
    3: (report: object) => ({
      ...renamed(report, ['attempts[].links.transcript'], trajectoryKey),
      reportVersion: 4,
    }),
    4: (report: object) => ({
      ...trialHrefs(revalued(renamed(report, REPORT_TRIALS, trialKey), REPORT_TRIAL_VALUES)),
      reportVersion: 5,
    }),
  },
  analysis: {
    1: (doc: object) => ({
      ...renamed(
        doc,
        [
          'attempts',
          'trials{}.attempt',
          ...['actions', 'anomalies', 'results', 'whatHappened', 'why'].flatMap((k) => [
            `analysis.${k}[].attempts`,
            `analysis.${k}[].trials[].attemptId`,
          ]),
        ],
        trialKey,
      ),
      schemaVersion: 2,
    }),
  },
  'analysis-note': {
    1: (note: object) => ({ ...renamed(note, ['attempts'], trialKey), schemaVersion: 2 }),
  },
  regrade: { 1: (doc: object) => ({ ...renamed(doc, ['attempts'], trialKey), schemaVersion: 2 }) },
  remarks: { 1: (doc: object) => remarksV2(doc) },
  'live-progress': {
    1: (doc: object) => ({
      ...renamed(doc, ['attempts', 'invocation.runs'], trialKey),
      schemaVersion: 2,
    }),
  },
  'bundle-manifest': {
    1: (manifest: object) => ({ ...renamed(manifest, ['args.runs'], trialKey), schemaVersion: 2 }),
  },
}

/** Each field a report at version 4 calls an attempt, the runs per cell or an arm. */
const REPORT_TRIALS = [
  'attempts',
  'trials[].arm',
  'header.runsPerCell',
  'roster[].attempts',
  'evals[].captures.rows[].arm',
  'evals[].captures.rows[].shots[].attempt',
  'evals[].choices[].rows[].arm',
  'evals[].choices[].rows[].attempts',
  'evals[].failures.clusters[].attempts',
  'evals[].headline.primary.attempts',
  'evals[].headline.primary.lead.arm',
  'evals[].headline.primary.lead.attempt',
  'evals[].primary.arms',
  'evals[].primary.assertionsByArm',
  'evals[].primary.effortByHarness[].arm',
  'evals[].primary.summary[].arm',
  'evals[].qualitative[].entries[].arm',
  'evals[].qualitative[].entries[].attempt',
  'evals[].qualitative[].themes[].quotes[].arm',
  'evals[].qualitative[].themes[].quotes[].attempt',
]

/** Each value a report at version 4 names a too-few verdict or remark with. */
const REPORT_TRIAL_VALUES = [
  'evals[].failures.remarks[].kind',
  'evals[].headline.fairness',
  'evals[].primary.contrasts[].verdict',
  'evals[].primary.summary[].verdict',
]

/** Each `transcript` field a run record at schemaVersion 1 has, as a READ_DEFAULTS path. */
const RECORD_TRAJECTORY = [
  'evals[].attempts[].files.transcript',
  'evals[].attempts[].files.rawTranscript',
  'evals[].attempts[].answers[].stateOptions.transcript',
  'evals[].answers[].stateOptions.transcript',
  'evals[].cases[].answers[].stateOptions.transcript',
  'stack.judge.state.transcript',
]

/** Each `transcript` field an event stream at schemaVersion 1 has outside its run-end record. */
const EVENTS_TRAJECTORY = [
  '<type=collected>.evals[].attempt.plan.questions[].state.transcript',
  '<type=eval-start>.attempt.plan.questions[].state.transcript',
  '<type=eval-end>.result.attempt.plan.questions[].state.transcript',
  '<type=run-end>.results[].attempt.plan.questions[].state.transcript',
]

const trajectoryKey = (key: string) =>
  key.replace('transcript', 'trajectory').replace('Transcript', 'Trajectory')

const recordV2 = (record: object) => ({
  ...renamed(record, RECORD_TRAJECTORY, trajectoryKey),
  schemaVersion: 2,
})

/** The fields a version-3 record, version-3 event stream or version-5 report renamed: trials, baseline, environment. */
const TRIAL_KEYS: Record<string, string> = {
  attempt: 'trial',
  attempts: 'trials',
  attemptId: 'trialId',
  attemptsPerMachine: 'trialsPerMachine',
  attemptsHeartbeatMs: 'trialsHeartbeatMs',
  runs: 'trials',
  runsPerCell: 'trialsPerCell',
  control: 'baseline',
  controlRate: 'baselineRate',
  controlOnly: 'baselineOnly',
  arm: 'environment',
  arms: 'environments',
  assertionsByArm: 'assertionsByEnvironment',
}
const trialKey = (key: string) => TRIAL_KEYS[key] ?? key

/** The values those versions renamed: a cell's role, a remark's kind and a verdict. */
const TRIAL_VALUES: Record<string, string> = {
  control: 'baseline',
  'too-few-tries': 'too-few-trials',
  'too-few-runs': 'too-few-trials',
}

/** Each field a run record at schemaVersion 2 calls an attempt, a run (of a cell), the control or an arm. */
const RECORD_TRIALS = [
  'budget.attempts',
  'config.runs',
  'invocation.runs',
  'plan.attempts',
  'profile.defaults.runs',
  'profile.limit.runs',
  'regrades[].attempts',
  'secretWarnings[].attemptId',
  'summary.attempts',
  'evals[].attempts',
  'evals[].lifts[].controlRate',
  'evals[].lifts[].discordant.controlOnly',
  'families[].lifts[].controlRate',
  'families[].lifts[].discordant.controlOnly',
  ...['evals[].answers[]', 'evals[].cases[].answers[]'].flatMap((a) => [
    `${a}.votes[].arm`,
    `${a}.votes[].attempts`,
  ]),
  ...['evals[].cells[]', 'evals[].cases[].cells[]'].flatMap((c) => [
    `${c}.runs`,
    `${c}.checks[].control`,
    `${c}.lift.control`,
  ]),
]

/** Each value a run record at schemaVersion 2 names the control or a remark kind with. */
const RECORD_TRIAL_VALUES = ['evals[].cells[].role', 'evals[].cases[].cells[].role']

/** A trial as an event stream at schemaVersion 2 has it, at each place it's carried. */
const EVENTS_TRIAL = [
  '<type=collected>.evals[]',
  '<type=eval-start>',
  '<type=eval-end>.result',
  '<type=run-end>.results[]',
]

/** Each field an event stream at schemaVersion 2 renamed, outside its run-end record. */
const EVENTS_TRIALS = [
  ...EVENTS_TRIAL.flatMap((t) => [
    `${t}.attempt`,
    `${t}.trial.plan.runs`,
    `${t}.trial.sandbox.attemptsPerMachine`,
    `${t}.trial.graderSandboxes[].sandbox.attemptsPerMachine`,
  ]),
  '<type=header>.attemptsHeartbeatMs',
  '<type=heartbeat>.attempts',
  '<type=plan>.header.attempts',
  '<type=plan>.header.budget.attempts',
  '<type=secret-warning>.attemptId',
]

const remarksV2 = (doc: object) => ({ ...revalued(doc, ['remarks[].kind']), schemaVersion: 2 })

const recordV3 = (record: object) => {
  renamed(record, RECORD_TRIALS, trialKey)
  revalued(record, RECORD_TRIAL_VALUES)
  return { ...record, schemaVersion: 3 }
}

/** `value` with the field at each path renamed to `to(key)`, in place. */
function renamed<T extends object>(value: T, paths: string[], to: (key: string) => string): T {
  for (const path of paths) {
    visit(value, path.split('.'), (parent, key) => {
      if (!(key in parent)) return
      parent[to(key)] = parent[key]
      delete parent[key]
    })
  }
  return value
}

/** `value` with the string at each path that `TRIAL_VALUES` renames replaced, in place. */
function revalued<T extends object>(value: T, paths: string[]): T {
  for (const path of paths) {
    visit(value, path.split('.'), (parent, key) => {
      const v = parent[key]
      if (typeof v === 'string' && v in TRIAL_VALUES) parent[key] = TRIAL_VALUES[v]
    })
  }
  return value
}

/** Points every `href` at a trial's anchor as `trialAnchorId` names it, at any depth. */
function trialHrefs<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const v of value) trialHrefs(v)
  } else if (isObject(value)) {
    const obj: Obj = value
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'href' && typeof v === 'string' && v.startsWith('#attempt-')) {
        obj[k] = `#trial-${v.slice('#attempt-'.length)}`
      } else {
        trialHrefs(v)
      }
    }
  }
  return value
}

/** The newest schemaVersion of each versioned shape this reeval reads. */
export const SCHEMA_VERSIONS = {
  'run-record': SCHEMA_VERSION,
  analysis: 2,
  'analysis-note': 2,
  remarks: 2,
  'live-progress': 2,
  'capture-page': 1,
  'run-events': 3,
  'bundle-manifest': 2,
  'archive-manifest': 1,
  credentials: 1,
  'cloud-origin': 1,
  'workspace-manifest': 1,
  regrade: 2,
} as const

/** A file from a newer reeval, whose version (`field`, `schemaVersion` by default) this reeval doesn't know. */
export class NewerSchemaError extends Error {
  override name = 'NewerSchemaError'
  /** The message without its subject: `written by a newer reeval (…). Upgrade reeval to read it.` */
  readonly reason: string
  constructor(what: string, version: number, newest: number, field = 'schemaVersion') {
    const reason = `written by a newer reeval (${field} ${version}; this reeval reads up to ${newest}). Upgrade reeval to read it.`
    super(`${what} was ${reason}`)
    this.reason = reason
  }
}

type Obj = Record<string, unknown>
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Calls `leaf` with each object the path's last segment is a key of, and that key. */
function visit(value: unknown, segments: string[], leaf: (parent: Obj, key: string) => void): void {
  if (!isObject(value)) return
  const [head = '', ...rest] = segments
  const branch = /^<(\w+)=(.+)>$/.exec(head)
  if (branch) {
    if (String(value[branch[1] as string]) === branch[2]) visit(value, rest, leaf)
    return
  }
  const [, key = head, walk] = /^(.+?)(\[\]|\{\})?$/.exec(head) ?? []
  if (!rest.length && !walk) {
    leaf(value, key)
    return
  }
  const child = value[key]
  const children =
    walk === '[]'
      ? Array.isArray(child)
        ? child
        : []
      : walk === '{}'
        ? isObject(child)
          ? Object.values(child)
          : []
        : [child]
  for (const c of children) visit(c, rest, leaf)
}

/** Fills in each read default of `shape` that `value` is missing, in place. */
export function fillDefaults<T>(shape: ShapeName, value: T): T {
  for (const d of READ_DEFAULTS[shape]) {
    visit(value, d.path.split('.'), (parent, key) => {
      if (parent[key] === undefined) parent[key] = d.empty()
    })
  }
  return value
}

function upgrade<T>(shape: keyof typeof SCHEMA_VERSIONS, value: T, what: string): T {
  const newest = SCHEMA_VERSIONS[shape]
  let version = (value as Obj).schemaVersion
  if (typeof version !== 'number') return value
  if (version > newest) throw new NewerSchemaError(what, version, newest)
  let v: unknown = value
  for (; version < newest; version++) {
    const migrate = MIGRATIONS[shape]?.[version]
    if (!migrate) break
    v = migrate(v as never)
  }
  return v as T
}

/**
 * A record as every reader sees it: migrated to this reeval's schemaVersion, with each field added
 * after it was written read as its default, so older runs keep loading in `reeval show`, `reeval query`,
 * compare, history and the studio, and an eval with `cases` recorded as one entry per case reads
 * as one eval (`foldCases`). A record from a newer reeval throws a `NewerSchemaError`.
 */
export function readableRecord(record: RunRecord, what = `Run ${record.runId}`): RunRecord {
  return foldCases(
    scored(unmeasuredReasoning(fillDefaults('run-record', upgrade('run-record', record, what)))),
  )
}

/**
 * An eval recorded before targets: each trial scores 1 for a pass and 0 for a fail, its cells
 * and the eval have their scores, and its target is read from the cells' gates.
 */
function scored(record: RunRecord): RunRecord {
  for (const e of record.evals ?? []) {
    if (e.target) continue
    const trials = e.trials ?? []
    for (const a of trials) {
      if (a.score === undefined && (a.outcome === 'pass' || a.outcome === 'fail')) {
        a.score = a.outcome === 'pass' ? 1 : 0
      }
    }
    const cells = e.cells ?? []
    const fill = (c: (typeof cells)[number], of: typeof trials) => {
      c.scores ??= scoresOf(of.filter((a) => a.cell === c.key))
    }
    for (const c of cells) fill(c, trials)
    for (const k of e.cases ?? []) {
      for (const c of k.cells ?? [])
        fill(
          c,
          trials.filter((a) => a.case === k.key),
        )
    }
    e.scores ??= meanScores(targetCells(cells).map((c) => c.scores))
    e.target = targetOfGates(cells.map((c) => c.gate))
  }
  return record
}

/**
 * A trial whose turns have no `reasoningMs` was recorded by a reeval that stored 0 for a
 * reasoning time no one measured (Codex's, Antigravity's, a turn with no reasoning block). On a
 * harness that now records `reasoningMs` on every turn (all but the fake one), that 0 reads as
 * unknown, as this reeval records it, unless the usage says no reasoning tokens were used. An
 * trial with no turns reasoned for an unknown time on any harness.
 */
function unmeasuredReasoning(record: RunRecord): RunRecord {
  for (const e of record.evals ?? []) {
    const kinds = new Map((e.cells ?? []).map((c) => [c.key, c.harnessKind]))
    for (const a of e.trials ?? []) {
      const turns = a.turns ?? []
      if (a.activity?.reasoningMs !== 0 || turns.some((t) => t.reasoningMs !== undefined)) continue
      const kind = kinds.get(a.cell)
      const timed = kind !== 'fake' && kind !== 'unknown'
      if (turns.length === 0 || (timed && a.usage?.reasoning !== 0)) a.activity.reasoningMs = null
    }
  }
  return record
}

/** A trajectory line as every reader sees it. */
export const readableTrajectoryLine = (line: TrajectoryLine): TrajectoryLine =>
  fillDefaults('trajectory-line', line)

/** An analysis document as every reader sees it; one from a newer reeval throws. */
export const readableAnalysis = (doc: AnalysisDoc, what = 'This analysis'): AnalysisDoc =>
  fillDefaults('analysis', upgrade('analysis', doc, what))

/** A run's remarks as every reader sees them; a file from a newer reeval throws. */
export const readableRemarks = (doc: RunRemarks, what = 'These remarks'): RunRemarks =>
  fillDefaults('remarks', upgrade('remarks', doc, what))

/** A line of `.reeval/cli.jsonl` as `reeval report` sees it. */
export const readableCliInvocation = (entry: CliInvocation): CliInvocation =>
  fillDefaults('cli-invocation', entry)

/** A capture's `<name>.capture.json` as the studio sees it; one from a newer reeval throws. */
export const readableCapturePage = (
  page: CapturePageFile,
  what = 'This capture',
): CapturePageFile => fillDefaults('capture-page', upgrade('capture-page', page, what))

/** A bundle's `manifest.json` as `reeval run --bundle` sees it; one from a newer reeval throws. */
export const readableBundleManifest = (
  manifest: BundleManifest,
  what = 'This bundle',
): BundleManifest => fillDefaults('bundle-manifest', upgrade('bundle-manifest', manifest, what))

/** A history archive's `reeval-archive.json` as `openArchive` sees it; one from a newer reeval throws. */
export const readableArchiveManifest = (
  manifest: ArchiveManifest,
  what = 'This archive',
): ArchiveManifest => fillDefaults('archive-manifest', upgrade('archive-manifest', manifest, what))

/** `reeval login`'s `credentials.json` as reeval reads it; one from a newer reeval throws. */
export const readableCredentials = (
  doc: CredentialsFile,
  what = 'The credentials file',
): CredentialsFile => fillDefaults('credentials', upgrade('credentials', doc, what))

/** A download's `.reeval/cloud/<run>.json` as `reeval run --resume` sees it; one from a newer reeval throws. */
export const readableCloudOrigin = <T>(doc: T, what = 'This marker'): T =>
  fillDefaults('cloud-origin', upgrade('cloud-origin', doc, what))

/** A line of a trial's `execs.jsonl` as every reader sees it. */
export const readableExecLine = (line: ExecLine): ExecLine => fillDefaults('exec-line', line)

/** A line of a trial's `decisions.jsonl` as every reader sees it. */
export const readableDecisionLine = (line: DecisionRecord): DecisionRecord =>
  fillDefaults('decision-line', line)

/** A running `reeval run`'s `live.json` at this reeval's version; one from a newer reeval throws. */
export const upgradedLiveProgress = <T>(doc: T): T =>
  upgrade('live-progress', doc, 'This progress file')

/** A trial's `workspace.json` as every reader sees it; one from a newer reeval throws. */
export const readableWorkspaceManifest = (
  manifest: WorkspaceManifest,
  what = 'This workspace manifest',
): WorkspaceManifest =>
  fillDefaults('workspace-manifest', upgrade('workspace-manifest', manifest, what))

/** A run's `regrades/<id>.json` as every reader sees it; one from a newer reeval throws. */
export const readableRegrade = (doc: RegradeRecord, what = 'This regrade'): RegradeRecord =>
  fillDefaults('regrade', upgrade('regrade', doc, what))

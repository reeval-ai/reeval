// `reeval regrade`: the eval files' graders today over attempts a run recorded. It never runs an
// agent, a task or a decision: it reads each attempt as the run kept it, plans what each grader
// needs (keep, re-score or recompute), runs the graders that changed and writes what changed in
// a regrade file beside the run, which readers apply.
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { routedJudge } from './attempt/judge.ts'
import { CommandError, lines, reachability } from './commands.ts'
import { matchesEvalId } from './engine/files.ts'
import { loadEvalFile } from './engine/loader.ts'
import { getRunContext, type TestOptions, useEngine } from './engine/runtime.ts'
import { bodyHash, caseHash, caseJson } from './eval-source.ts'
import { declareDefault, resetDeclarationCollector, withDefaultGraders } from './evaluate.ts'
import type { GradeInputs } from './grade/context.ts'
import { readData } from './grade/context.ts'
import { type GraderDef, graderList } from './grade/define.ts'
import { type JudgeRun, readReference } from './grade/judge.ts'
import { expectedFingerprint, rescoredGrade, runGraders } from './grade/run.ts'
import { GRADER_HARNESS, graderImage, imagePart, sandboxStarter } from './grade/sandbox.ts'
import type { GraderTurn } from './grade/types.ts'
import { listRuns, readOriginal, readRecord, recordFile, runDir } from './history/files.ts'
import { gradedOutcome, newRegradeId, writeRegrade } from './history/regrades.ts'
import { findingLines, scanText } from './history/secret-scan.ts'
import { readStoredAttempt } from './history/stored-attempt.ts'
import type {
  AttemptRecord,
  EvalEntry,
  HistoryEntry,
  RegradeAction,
  RegradedAttempt,
  RegradeRecord,
  RunRecord,
} from './history/types.ts'
import { unreachable } from './history/views.ts'
import { sha256 } from './ids.ts'
import { askJudge, judgeModelName } from './judge/index.ts'
import { mergeJudge, resolveStateOptions } from './judge/state-options.ts'
import { isObjectLike } from './object.ts'
import { profileJudge } from './options.ts'
import { redactSecrets } from './redact.ts'
import { PACKAGE_VERSION } from './root.ts'
import { capMiddle } from './text.ts'
import type {
  BuiltinKind,
  Case,
  GradeFingerprint,
  GradeRecord,
  JudgeOptions,
  ResolvedConfig,
  ResolvedProfile,
  RunContext,
  SandboxDescriptor,
  TranscriptEvent,
} from './types.ts'

export type RegradeOptions = {
  /** Eval filters, as `reeval run` takes them. */
  filters: string[]
  /** `--tag`: each a tag, or `!tag` to exclude one. */
  tags: string[]
  /** `--grader`: only these graders run. */
  graders: string[]
  since?: string
  at?: string
  allBranches?: boolean
  dryRun?: boolean
  yes?: boolean
  /** Asks before a regrade that calls a model or starts a sandbox; unset outside a terminal. */
  confirm?: (question: string) => Promise<boolean>
  /**
   * The profile a run's graders read: `--profile`'s when given, else the one the run recorded
   * (`name`). Throws when that profile is gone from the config.
   */
  profileFor?: (name: string | undefined) => ResolvedProfile | null
  out: (line: string) => void
}

/** Built-ins that read the turns' transcripts. */
const TRANSCRIPT_KINDS: ReadonlySet<BuiltinKind> = new Set([
  'used-skill',
  'called-tool',
  'called-mcp',
  'ran',
  'searched',
  'fetched',
  'wrote',
  'within-limits',
])

/** The record's cut of a subagent's prompt and last message, past which they end in `…`. */
const SUBAGENT_TEXT_LIMIT = 8 * 1024

/** An eval file's eval as it is today, or why it can't be read. */
type CurrentEval = {
  defs: GraderDef[]
  cases?: readonly Case[]
  judge: JudgeOptions
  drift: 'unchanged' | 'changed since'
  file: string
  /**
   * Each case's hash as a run would record it today, by key, from planning the eval file as a run
   * does (so the `secret()` values its attempts read are masked the same way); a case no attempt
   * plans is absent.
   */
  caseHashes?: Map<string, string>
  /** By case key, the host variables its attempts read `secret()` values from that are unset now. */
  unsetSecrets?: Map<string, string[]>
  /** Why planning the eval file failed, when it did and the hashes are the bare cases'. */
  planError?: string
}

type Status =
  | 'unchanged'
  | 'score changed'
  | 'grader changed'
  | 'new'
  | 'grader not found'
  | 'not selected'
  | 'inputs missing'

/** What happens to one grader on one attempt. */
type Step = {
  grader: string
  status: Status
  def?: GraderDef
  stored?: GradeRecord
  changed?: string[]
  reason?: string
  /** What the plan couldn't check. */
  note?: string
  /** The grader can't run as it's configured today, which fails the regrade. */
  refused?: true
}

/** A grader a regrade ran that errored: its stored grade stays. */
type Failure = { run: string; attempt: string; grader: string; error: string }

type PlannedAttempt = { attempt: AttemptRecord; steps: Step[] }

type PlannedRun = {
  entry: HistoryEntry
  record: RunRecord
  evals: Array<{ entry: EvalEntry; current: CurrentEval | string; attempts: PlannedAttempt[] }>
}

const ACTION: Record<Status, RegradeAction['action']> = {
  unchanged: 'kept',
  'not selected': 'kept',
  'score changed': 'rescored',
  'grader changed': 'recomputed',
  new: 'new',
  'grader not found': 'not-found',
  'inputs missing': 'inputs-missing',
}

const runs = (step: Step) => step.status === 'grader changed' || step.status === 'new'

/** `30d`, `12h`, `2w` or `90m`, in milliseconds. */
function sinceMs(value: string): number {
  const match = /^(\d+(?:\.\d+)?)(m|h|d|w)$/.exec(value.trim())
  const unit = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 7 * 86_400_000 }
  const ms = match ? Number(match[1]) * unit[match[2] as keyof typeof unit] : 0
  if (!(ms > 0)) {
    throw new CommandError(`--since takes a duration such as 30d, 12h or 2w (got "${value}")`)
  }
  return ms
}

const tagsHold = (tags: readonly string[], wanted: readonly string[]) =>
  wanted.every((t) => (t.startsWith('!') ? !tags.includes(t.slice(1)) : tags.includes(t)))

/** The runs a regrade reads: each selected eval's newest, those since a time, or those at a commit. */
async function selectRuns(
  config: ResolvedConfig,
  o: RegradeOptions,
): Promise<Array<{ entry: HistoryEntry; record: RunRecord; evals: EvalEntry[] }>> {
  let entries = await listRuns(config.root, config.history.dir, true)
  if (!o.allBranches && o.at === undefined) {
    const reach = await reachability(
      config.root,
      entries.map((e) => e.git?.sha),
    )
    entries = entries.filter((e) => !unreachable(e, reach))
  }
  if (o.at !== undefined) {
    const sha = (await lines(config.root, ['rev-parse', '--verify', `${o.at}^{commit}`]))?.[0]
    if (!sha) throw new CommandError(`--at ${o.at} isn't a commit git knows`)
    entries = entries.filter((e) => e.git?.sha === sha)
  }
  if (o.since !== undefined) {
    const from = Date.now() - sinceMs(o.since)
    entries = entries.filter((e) => Date.parse(e.startedAt) >= from)
  }
  const wanted = (e: EvalEntry) =>
    (!o.filters.length || o.filters.some((f) => matchesEvalId(e.id, f))) &&
    tagsHold(e.tags, o.tags) &&
    e.attempts.some(gradable)
  const picked: Array<{ entry: HistoryEntry; record: RunRecord; evals: EvalEntry[] }> = []
  const latest = new Set<string>()
  for (const entry of [...entries].reverse()) {
    const record = await readRecord(recordFile(config.history.dir, entry.runId))
    const evals = record.evals.filter(
      (e) => wanted(e) && (o.since !== undefined || o.at !== undefined || !latest.has(e.id)),
    )
    for (const e of evals) latest.add(e.id)
    if (evals.length) picked.unshift({ entry, record, evals })
  }
  return picked
}

/**
 * An attempt a regrade grades: one whose graders ran, or one that passed without any, which a new
 * grader can grade. A task failure, a timeout, a cancel or an infra error never reached its graders.
 */
const gradable = (a: AttemptRecord) => a.grades !== undefined || a.outcome === 'pass'

/** Loads `entry`'s eval file in this process and reads its graders, cases and judge as they are now. */
async function currentEval(
  config: ResolvedConfig,
  profile: ResolvedProfile | null,
  entry: EvalEntry,
): Promise<CurrentEval | string> {
  const file = join(config.root, ...entry.file.split('/'))
  if (!existsSync(file)) return 'eval deleted since'
  if (!/\.(?:[mc]?ts|[mc]?js|tsx|jsx)$/.test(file)) {
    return `eval in ${entry.file}: reeval regrade reads TypeScript and JavaScript eval files`
  }
  const loaded = await loadEvalFile(file, config.root)
  const value =
    isObjectLike(loaded) && Object.keys(loaded).includes('default')
      ? (loaded as { default?: unknown }).default
      : undefined
  if (!isObjectLike(value) || !(Symbol.for('reeval.eval') in value)) {
    return `eval in ${entry.file}: its default export isn't a defineEval result`
  }
  const spec = value as {
    task?: (...args: never[]) => unknown
    graders?: unknown
    cases?: unknown
    judge?: Partial<JudgeOptions>
  }
  const own = spec.graders === undefined ? [] : graderList(spec.graders, entry.file)
  const judge = mergeJudge(
    mergeJudge(config.judge as JudgeOptions, profile ? profileJudge(profile) : undefined),
    spec.judge,
  )
  const body = typeof spec.task === 'function' ? bodyHash(spec.task, entry.file, file) : undefined
  const cases = Array.isArray(spec.cases) ? (spec.cases as Case[]) : undefined
  return {
    defs: withDefaultGraders(own, { config, profile }),
    ...(cases ? { cases, ...plannedCases(file, loaded, cases, profile) } : {}),
    judge,
    drift: entry.source && body !== entry.source.body ? 'changed since' : 'unchanged',
    file,
  }
}

const isFull = (mode: unknown) =>
  mode === 'full' || (isObjectLike(mode) && (mode as { detail?: string }).detail === 'full')

/** What the run kept of one attempt for its graders, read once. */
type Kept = {
  events: Map<number, TranscriptEvent[]> | null
  /** Why the kept transcript can't be read, when a line of it isn't JSON. */
  bad?: string
  /** A tool event or subagent text the record cut, which the live graders saw whole. */
  cut: boolean
  workspace: boolean
  /** The skills the attempt's environment placed: none when it ran in none, null when its record is gone. */
  skills: string[] | null
  /** Every foreground `c.exec`'s result is readable: none ran, or `execs.jsonl` was kept. */
  execs: boolean
  /** Every `c.decide` call is readable: none was made, or `decisions.jsonl` was kept. */
  decisions: boolean
  /** The observations whose values were kept, by name. */
  observations: Set<string>
  /** The captures kept, by name. */
  captures: Set<string>
  /** The run's artifact level dropped files of this attempt (its workspace, execs or captures). */
  trimmed: boolean
}

const NULL_SHA = sha256('null')

async function keptOf(dir: string, record: RunRecord, entry: EvalEntry, a: AttemptRecord) {
  let events: Map<number, TranscriptEvent[]> | null = null
  let bad: string | undefined
  let cut = (a.subagents ?? []).some((s) =>
    [s.prompt, s.finalMessage ?? ''].some((t) => t.length > SUBAGENT_TEXT_LIMIT && t.endsWith('…')),
  )
  if (a.files.transcript) {
    const path = a.files.transcript.path
    const text = await readFile(join(dir, ...path.split('/')), 'utf8').catch(() => null)
    if (text !== null) {
      events = new Map()
      for (const [n, line] of text.split('\n').entries()) {
        if (!line) continue
        let parsed: { turn: number; type: string }
        try {
          parsed = JSON.parse(line)
        } catch {
          bad = `line ${n + 1} of ${path} isn't JSON`
          events = null
          break
        }
        const { turn, ...event } = parsed
        if (event.type === 'prompt' || event.type === 'turn-end' || event.type === 'decision') {
          continue
        }
        if (JSON.stringify(event).includes('[reeval: truncated ')) cut = true
        events.set(turn, [...(events.get(turn) ?? []), event as unknown as TranscriptEvent])
      }
    }
  }
  const cell = entry.cells.find((c) => c.key === a.cell)
  const env = record.environments.find((e) => e.digest === cell?.environmentDigest)
  const skills = env
    ? env.skills.map((s) => s.name)
    : cell && cell.environmentDigest === null
      ? []
      : null
  const execs = !a.checks.length || !!a.files.execs
  const decisions = !a.decisionUse || !!a.files.decisions
  return {
    events,
    ...(bad ? { bad } : {}),
    cut,
    workspace: !!a.files.workspace,
    skills,
    execs,
    decisions,
    observations: new Set(
      (a.observations ?? [])
        .filter((o) => o.file || o.value !== null || o.sha256 === NULL_SHA)
        .map((o) => o.name),
    ),
    captures: new Set((a.files.artifacts ?? []).map((r) => r.name)),
    trimmed: !execs || !decisions || (!!a.workspace?.bytes && !a.files.workspace),
  } satisfies Kept
}

const EXECS_GONE = "the c.exec results weren't kept"
const CUT =
  'the kept transcript cuts tool input or output, or subagent text, the live graders saw whole'

/** Why reading the observations `names` (every one for `true`) needs a value the run didn't keep. */
function observationGone(a: AttemptRecord, kept: Kept, names: true | readonly string[]) {
  const lost = (names === true ? (a.observations ?? []).map((o) => o.name) : names).filter(
    (n) => (a.observations ?? []).some((o) => o.name === n) && !kept.observations.has(n),
  )
  return lost.length ? `observation ${lost.join(', ')} wasn't kept` : undefined
}

/** Why `def` can't be graded from what the run kept of the attempt, or undefined when it can. */
function missingInput(def: GraderDef, a: AttemptRecord, kept: Kept): string | undefined {
  const { run, builtin } = def
  const textCut = a.turns.some((t) => t.text.includes('… [reeval: truncated '))
  if (run.kind === 'judge') {
    const wanted = resolveStateOptions(run.inputs)
    if (wanted.transcript && kept.bad) return kept.bad
    if (wanted.transcript && !kept.events) return "the transcript wasn't kept"
    if (wanted.transcript && isFull(wanted.transcript) && kept.cut) return CUT
    if (wanted.output && textCut && !kept.events) {
      return "the final message was cut and the transcript wasn't kept"
    }
    if ((wanted.contents.length || wanted.files) && !kept.workspace) {
      return "the final workspace wasn't kept"
    }
    if (run.inputs.reference === 'diff' && !kept.workspace) return "the final workspace wasn't kept"
    if (wanted.diff && !a.files.diff && a.changedFiles.length) return "the diff wasn't kept"
    if (wanted.checks && !kept.execs) return EXECS_GONE
    if (wanted.observations) {
      const gone = observationGone(a, kept, wanted.observations)
      if (gone) return gone
    }
    const shots = run.inputs.artifacts
    if (shots === true && kept.trimmed) return "the attempt's captures weren't kept"
    if (Array.isArray(shots)) {
      const lost = shots
        .map((s) => (typeof s === 'string' ? s : s.name))
        .filter((n) => !kept.captures.has(n))
      if (lost.length) return `capture ${lost.join(', ')} wasn't kept`
    }
    return undefined
  }
  const custom = !builtin
  const kind = builtin?.kind
  const transcript = custom || TRANSCRIPT_KINDS.has(kind as BuiltinKind)
  if (transcript && kept.bad) return kept.bad
  if (transcript && !kept.events) return "the transcript wasn't kept"
  if (transcript && kept.cut) return CUT
  if ((custom || kind === 'used-skill') && !kept.skills) {
    return "the attempt's environment record is missing"
  }
  if (run.files.some((p) => !p.startsWith('!')) && !kept.workspace) {
    return `${run.files.join(', ')} wasn't kept: the attempt has no kept workspace`
  }
  if ((custom || kind === 'succeeded') && !kept.execs) return EXECS_GONE
  if (custom && !kept.decisions) return "the c.decide calls weren't kept"
  if (custom && kept.trimmed) return "the run's artifact level dropped this attempt's files"
  if (custom) return observationGone(a, kept, true)
  const main = String(builtin?.args[0] ?? '')
  if (
    (kind === 'page-status' || kind === 'no-page-errors') &&
    kept.trimmed &&
    !kept.captures.has(main)
  ) {
    return `capture ${main} wasn't kept`
  }
  if (kind === 'observed') return observationGone(a, kept, [main])
  return undefined
}

/** The parts of a fingerprint that differ, by name. */
const changedParts = (was: GradeFingerprint, now: GradeFingerprint) =>
  [...new Set([...Object.keys(was), ...Object.keys(now)])].filter(
    (k) =>
      k !== 'digest' && (was as Record<string, unknown>)[k] !== (now as Record<string, unknown>)[k],
  )

/** The case an attempt graded, from the eval's cases today; undefined when it's gone. */
const caseOf = (current: CurrentEval, a: AttemptRecord): Case | undefined =>
  a.case === undefined ? { key: '' } : current.cases?.find((c) => c.key === a.case)

/** Why the attempt's case today isn't the one its agent worked on, or undefined when it is. */
function caseIssue(current: CurrentEval, entry: EvalEntry, a: AttemptRecord): string | undefined {
  if (a.case === undefined) return undefined
  const item = caseOf(current, a)
  const name = JSON.stringify(a.case)
  if (!item) return `case ${name} is no longer in the eval's cases`
  const recorded = entry.cases?.find((c) => c.key === a.case)?.hash
  if (recorded === undefined) return undefined
  let now = current.caseHashes?.get(item.key)
  if (now === undefined) {
    try {
      now = caseHash(caseJson(item, `case ${name}`, current.file))
    } catch {
      now = undefined
    }
  }
  if (now === recorded) return undefined
  const unset = current.unsetSecrets?.get(item.key)
  if (unset?.length) {
    const vars = unset.join(', ')
    return `case ${name} reads secret${unset.length === 1 ? '' : 's'} from ${vars}, unset here, so its data can't be checked against the run's`
  }
  if (current.planError !== undefined) {
    return `case ${name} can't be checked against the run's: planning the eval file failed (${current.planError})`
  }
  return `case changed: case ${name}'s data isn't what the run had`
}

const NO_MODEL = "no judge model: neither the grader nor the eval's judge names one today"

/** A judge grader's models today: its own, else the eval's judge model. */
const judgeModels = (run: JudgeRun, current: CurrentEval) =>
  run.models ?? (current.judge.model !== undefined ? [current.judge.model] : [])

/**
 * Each fingerprint part a grade records only when it runs, for `def` on `item`: its data, its
 * image, its reference and its models. Without `images` (a dry run, which prepares none) the
 * image part is `stored`'s.
 */
async function partsOf(
  def: GraderDef,
  item: Case,
  current: CurrentEval,
  root: string,
  regradeId: string,
  images: boolean,
  stored: GradeFingerprint | undefined,
): Promise<Parameters<typeof expectedFingerprint>[1]> {
  const { run } = def
  if (run.kind === 'judge') {
    const ref = await readReference(run, item, `judge grader ${def.name}`)
    return {
      models: judgeModels(run, current).map(judgeModelName),
      ...(ref ? { reference: ref.digest } : {}),
    }
  }
  const { digest } = await readData(run.data)
  const image = !run.env
    ? undefined
    : images
      ? imagePart(run.env, root, (await graderImage(root, regradeId, run.env.sandbox))?.id)
      : stored?.image
  return { ...(digest ? { data: digest } : {}), ...(image ? { image } : {}) }
}

async function planAttempt(
  a: AttemptRecord,
  entry: EvalEntry,
  current: CurrentEval,
  kept: Kept,
  only: readonly string[],
  root: string,
  regradeId: string,
  images: boolean,
): Promise<Step[]> {
  const stored = a.grades ?? []
  const item = caseOf(current, a) ?? { key: a.case ?? '' }
  const badCase = caseIssue(current, entry, a)
  const steps: Step[] = []
  for (const def of current.defs) {
    const was = stored.find((g) => g.grader === def.name)
    const base = {
      grader: def.name,
      def,
      ...(was ? { stored: was } : {}),
      ...(!images && def.run.kind === 'code' && def.run.env
        ? { note: 'image not checked in a dry run' }
        : {}),
    }
    if (only.length && !only.includes(def.name)) {
      if (was) steps.push({ ...base, status: 'not selected' })
      continue
    }
    const noModel = def.run.kind === 'judge' && !judgeModels(def.run, current).length
    const missing = () =>
      noModel
        ? { reason: NO_MODEL, refused: true as const }
        : (() => {
            const reason = badCase ?? missingInput(def, a, kept)
            return reason ? { reason } : undefined
          })()
    if (!was) {
      const why = missing()
      steps.push(why ? { ...base, status: 'inputs missing', ...why } : { ...base, status: 'new' })
      continue
    }
    let now: GradeFingerprint
    try {
      now = expectedFingerprint(
        def,
        await partsOf(def, item, current, root, regradeId, images, was.fingerprint),
      )
    } catch (error) {
      steps.push({
        ...base,
        status: 'inputs missing',
        reason: `its fingerprint can't be read: ${redactSecrets((error as Error).message.split('\n')[0] ?? '')}`,
        refused: true,
      })
      continue
    }
    if (now.digest !== was.fingerprint.digest) {
      const changed = changedParts(was.fingerprint, now)
      const why = missing()
      steps.push(
        why
          ? { ...base, status: 'inputs missing', changed, ...why }
          : { ...base, status: 'grader changed', changed },
      )
    } else if (
      (def.scoreDigest ?? '') !== (was.scoreDigest ?? '') ||
      def.weight !== was.weight ||
      def.required !== was.required
    ) {
      steps.push({ ...base, status: 'score changed' })
    } else steps.push({ ...base, status: 'unchanged' })
  }
  for (const g of stored) {
    if (!current.defs.some((d) => d.name === g.grader)) {
      steps.push({ grader: g.grader, status: 'grader not found', stored: g })
    }
  }
  return steps
}

/** The attempt's turns as its graders read them live, from its record and transcript. */
function storedTurns(a: AttemptRecord, kept: Kept): GraderTurn[] {
  return a.turns.map((t, i) => {
    const said = kept.events?.get(i) ?? []
    // The record cuts a long final message; the transcript's last text event has it whole.
    const last = t.text.includes('… [reeval: truncated ')
      ? said.findLast((x) => x.type === 'text' && !('subagent' in x && x.subagent))
      : undefined
    return {
      prompt: t.prompt,
      text: last?.type === 'text' ? last.text : t.text,
      status: t.status,
      startedAt: t.startedAt,
      durationMs: t.durationMs,
      transcript: said,
      usage: t.usage,
      model: t.model,
      unreported: t.unreported,
      ...(t.cost ? { cost: t.cost } : {}),
    }
  })
}

function judgeOf(current: CurrentEval): NonNullable<GradeInputs['judge']> {
  const { judge } = current
  return {
    ...(judge.model !== undefined ? { model: judge.model } : {}),
    ask: (question, answers, state, model, signal) =>
      routedJudge(
        { ...judge, model },
        (routed) => askJudge(question, answers, state, routed, signal),
        signal,
      ),
  }
}

/**
 * Whether a grade's error says the grade couldn't be had today rather than what the grader made
 * of the attempt: an interrupt, a timeout, or anything from a judge (its provider, its network,
 * its answer). A code grader's own throw is its grade, scored 0 as a run scores it.
 */
const heldBack = (def: GraderDef, error: string, signal: AbortSignal) =>
  signal.aborted || def.run.kind === 'judge' || /^(grade|judge) timed out after /.test(error)

/**
 * Runs what `steps` plans for the attempt. A grader whose grade can't be had today (`heldBack`,
 * a grader sandbox that fails to start, a stored attempt that can't be read) keeps its stored grade
 * and is returned in `failed`; `done` is the attempt as regraded, or undefined when nothing
 * changed.
 */
async function regradeAttempt(
  dir: string,
  record: RunRecord,
  entry: EvalEntry,
  current: CurrentEval,
  planned: PlannedAttempt,
  signal: AbortSignal,
): Promise<{ done?: RegradedAttempt; failed: Map<string, string> }> {
  const { attempt: a, steps } = planned
  const failed = new Map<string, string>()
  if (!steps.some((s) => runs(s) || s.status === 'score changed')) return { failed }
  const toRun = steps.filter(runs).map((s) => s.def as GraderDef)
  let ran: GradeRecord[] = []
  if (toRun.length) {
    try {
      const kept = await keptOf(dir, record, entry, a)
      const inputs: GradeInputs = {
        case: caseOf(current, a) as Case,
        turns: storedTurns(a, kept),
        stored: await readStoredAttempt(dir, a),
        skills: kept.skills ?? [],
        subagents: a.turns.map((_, i) =>
          (a.subagents ?? []).filter((s) => s.turn === i).map(({ n: _n, turn: _turn, ...s }) => s),
        ),
        judge: judgeOf(current),
        ...(toRun.some((d) => d.run.kind === 'code' && d.run.env) && {
          // No attempt sandbox holds a slot here, so each grader sandbox takes its own.
          sandboxes: sandboxStarter(a.key, { kind: 'fake' } as SandboxDescriptor),
        }),
      }
      ran = await runGraders(toRun, inputs, signal)
    } catch (error) {
      const why = redactSecrets((error as Error).message.split('\n')[0] ?? '')
      for (const d of toRun) failed.set(d.name, why)
    }
  }
  for (const g of ran) {
    const def = toRun.find((d) => d.name === g.grader) as GraderDef
    if (g.error !== undefined && heldBack(def, g.error, signal)) {
      failed.set(g.grader, redactSecrets(g.error.split('\n')[0] ?? ''))
    }
  }
  const grades: GradeRecord[] = []
  for (const s of steps) {
    const now = runs(s) && !failed.has(s.grader) && ran.find((g) => g.grader === s.grader)
    if (now) grades.push(now)
    else if (s.status === 'score changed') {
      grades.push(rescoredGrade(s.def as GraderDef, s.stored as GradeRecord))
    } else if (s.stored) grades.push(s.stored)
  }
  const applied = steps.filter(
    (s) => s.status === 'score changed' || (runs(s) && !failed.has(s.grader)),
  )
  if (!applied.length) return { failed }
  return {
    failed,
    done: {
      key: a.key,
      grades,
      ...gradedOutcome(grades, entry.target),
      actions: steps.map((s) => {
        const error = failed.get(s.grader)
        return error !== undefined
          ? { grader: s.grader, action: 'failed', reason: capMiddle(error, 500) }
          : {
              grader: s.grader,
              action: ACTION[s.status],
              ...(s.changed?.length ? { changed: s.changed } : {}),
              ...(s.reason ? { reason: s.reason } : {}),
            }
      }),
    },
  }
}

/** An attempt as a plan counts it: the most a regrade does to any of its graders. */
function attemptClass(steps: readonly Step[]): 'recompute' | 'rescore' | 'missing' | 'unchanged' {
  if (steps.some(runs)) return 'recompute'
  if (steps.some((s) => s.status === 'score changed')) return 'rescore'
  if (steps.some((s) => s.status === 'inputs missing')) return 'missing'
  return 'unchanged'
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const ACTION_WORD: Record<Status, string> = {
  unchanged: 'keep',
  'not selected': 'keep',
  'score changed': 're-score',
  'grader changed': 'recompute',
  new: 'compute',
  'grader not found': 'keep old grade',
  'inputs missing': 'skip',
}

/** What running `steps` of one grader on `n` attempts costs. */
function cost(def: GraderDef | undefined, status: Status, n: number): string {
  if (status !== 'grader changed' && status !== 'new') {
    return status === 'score changed' ? 'no calls' : ''
  }
  if (def?.run.kind === 'judge') {
    const models = def.run.models?.length ?? 1
    return `${plural(n * models, 'judge call')}${models > 1 ? ` (${models} models)` : ''}`
  }
  if (def?.run.kind === 'code' && def.run.env) return `${n} ${n === 1 ? 'sandbox' : 'sandboxes'}`
  return plural(n, 'attempt')
}

function pad(text: string, width: number): string {
  return text.length >= width ? `${text} ` : text.padEnd(width)
}

async function subject(root: string, sha: string | undefined): Promise<string> {
  if (!sha) return ''
  const line = (await lines(root, ['log', '-1', '--format=%s', sha]))?.[0]
  return line ? ` "${line.length > 40 ? `${line.slice(0, 39)}…` : line}"` : ''
}

async function formatPlan(root: string, plan: PlannedRun[]): Promise<string[]> {
  const attempts = plan.flatMap((r) => r.evals.flatMap((e) => e.attempts))
  const classes = attempts.map((p) => attemptClass(p.steps))
  const count = (c: string) => classes.filter((x) => x === c).length
  const evalIds = new Set(plan.flatMap((r) => r.evals.map((e) => e.entry.id)))
  const out = [
    `${plural(evalIds.size, 'eval')}, ${plural(attempts.length, 'attempt')} in ${plural(plan.length, 'run')}: ${count('recompute')} to recompute, ${count('rescore')} to re-score, ${count('unchanged')} unchanged, ${count('missing')} can't be regraded`,
  ]
  const byEval = new Map<string, Array<{ run: PlannedRun; e: PlannedRun['evals'][number] }>>()
  for (const run of plan) {
    for (const e of run.evals) {
      byEval.set(e.entry.id, [...(byEval.get(e.entry.id) ?? []), { run, e }])
    }
  }
  const steps = attempts.flatMap((p) => p.steps)
  const nameWidth = Math.max(12, ...steps.map((s) => s.grader.length + 2))
  const statusOf = (step: Step) =>
    step.status === 'grader changed' ? `grader changed: ${step.changed?.join(', ')}` : step.status
  const statusWidth = Math.max(16, ...steps.map((s) => statusOf(s).length + 2))
  for (const [id, list] of byEval) {
    const first = list[list.length - 1]?.e.current
    out.push(
      '',
      `${pad(id, nameWidth + 4)}eval ${typeof first === 'string' ? first.replace(/^eval /, '') : first?.drift}`,
    )
    for (const { run, e } of list) {
      const git = run.entry.git
      const when = `${run.entry.startedAt.slice(0, 16).replace('T', ' ')} UTC`
      const where = git ? `${git.branch ?? 'detached'}@${git.sha.slice(0, 7)}` : 'no git'
      out.push(
        `  ${when}  ${where}${await subject(root, git?.sha)}  ${plural(e.attempts.length, 'attempt')}`,
      )
      const rows = new Map<string, { step: Step; n: number }>()
      for (const p of e.attempts) {
        for (const s of p.steps) {
          const key = `${s.grader}\0${s.status}\0${s.changed?.join(',') ?? ''}\0${s.reason ?? ''}\0${s.note ?? ''}`
          const row = rows.get(key) ?? { step: s, n: 0 }
          row.n++
          rows.set(key, row)
        }
      }
      const shown = new Set<string>()
      for (const { step, n } of rows.values()) {
        const name = shown.has(step.grader) ? '' : step.grader
        shown.add(step.grader)
        const status = statusOf(step)
        const action = step.status === 'inputs missing' ? `skip ${n}` : ACTION_WORD[step.status]
        const extra = [
          step.status === 'inputs missing' ? step.reason : cost(step.def, step.status, n),
          step.note && runs(step) ? `(${step.note})` : '',
        ]
          .filter(Boolean)
          .join(' ')
        out.push(
          `    ${pad(name, nameWidth)}${pad(status, statusWidth)}${pad(action, 16)}${extra ?? ''}`.trimEnd(),
        )
      }
    }
  }
  return out
}

/** `x/y → x'/y passed` for one grader's grades before and after. */
function passed(before: Array<GradeRecord | undefined>, after: Array<GradeRecord | undefined>) {
  const n = (list: Array<GradeRecord | undefined>) => list.filter((g) => g?.score === 1).length
  const scored = (g: GradeRecord | undefined) => g !== undefined && g.score !== null
  if (!before.some(scored) && !after.some(scored)) return 'recorded'
  return `${n(before)}/${before.length} → ${n(after)}/${after.length} passed`
}

/** The eval file the regrade engine is declaring, and the tests it planned. */
const declaring: { file?: string; tests: TestOptions[] } = { tests: [] }

/** A minimal engine for loading eval files, planning them and starting grader sandboxes in this process. */
function regradeEngine(context: RunContext) {
  useEngine({
    registerTest(_name, options) {
      declaring.tests.push(options)
    },
    registerGroup(_name, _mode, body) {
      body()
    },
    getRunContext: () => context,
    collectingFile: () => declaring.file,
    declarePlanned() {},
  })
}

/**
 * Plans the loaded eval file `file` under `profile` as a run would: each case's `source.case`
 * hash and the `secret()` variables its attempts read that are unset here, by key, or why
 * planning it threw.
 */
function plannedCases(
  file: string,
  loaded: unknown,
  cases: readonly Case[],
  profile: ResolvedProfile | null,
): Pick<CurrentEval, 'caseHashes' | 'unsetSecrets' | 'planError'> {
  const context = getRunContext()
  const was = context.profile
  resetDeclarationCollector()
  declaring.tests = []
  declaring.file = file
  context.profile = profile
  try {
    declareDefault(file, loaded)
  } catch (error) {
    return { planError: redactSecrets((error as Error).message.split('\n')[0] ?? '') }
  } finally {
    context.profile = was
    declaring.file = undefined
    resetDeclarationCollector()
  }
  const caseHashes = new Map<string, string>()
  const unsetSecrets = new Map<string, string[]>()
  for (const { attempt } of declaring.tests) {
    const key = attempt?.family ? cases[attempt.family.case]?.key : undefined
    if (key === undefined || !attempt) continue
    if (attempt.source.case) caseHashes.set(key, attempt.source.case)
    const unset = attempt.secretVars.filter((v) => !process.env[v])
    if (unset.length)
      unsetSecrets.set(key, [...new Set([...(unsetSecrets.get(key) ?? []), ...unset])])
  }
  declaring.tests = []
  return { caseHashes, unsetSecrets }
}

/** `reeval regrade`: plans, asks, regrades and writes each run's regrade file; the exit code. */
export async function regrade(
  config: ResolvedConfig,
  profile: ResolvedProfile | null,
  o: RegradeOptions,
): Promise<number> {
  // A regrade grades the runs as they read now, earlier regrades applied.
  readOriginal(false)
  const at = new Date()
  const id = newRegradeId(at)
  const stagingDir = join(config.root, '.reeval', 'staging', `regrade-${id}`)
  const context: RunContext = {
    runId: `regrade-${id}`,
    stagingDir,
    config,
    tags: [],
    concurrency: config.concurrency ?? 4,
    profile,
  }
  regradeEngine(context)
  const selected = await selectRuns(config, o)
  if (!selected.length) {
    o.out(
      o.at !== undefined
        ? `Nothing to regrade: no recorded run at ${o.at} has a graded attempt of the selected evals.`
        : 'Nothing to regrade: no recorded run that HEAD reaches has a graded attempt of the selected evals.',
    )
    return 0
  }
  const currents = new Map<string, CurrentEval | string>()
  const currentKey = (record: RunRecord, e: EvalEntry) => `${record.profile?.name ?? ''}\0${e.id}`
  for (const { record, evals } of selected) {
    let runProfile = profile
    let refused: string | undefined
    try {
      if (o.profileFor) runProfile = o.profileFor(record.profile?.name)
    } catch (error) {
      refused = `profile ${record.profile?.name} the run recorded: ${(error as Error).message}`
    }
    for (const e of evals) {
      const key = currentKey(record, e)
      if (!currents.has(key)) {
        currents.set(key, refused ?? (await currentEval(config, runProfile, e)))
      }
    }
  }
  if (o.graders.length) {
    const known = new Set(
      [...currents.values()].flatMap((c) =>
        typeof c === 'string' ? [] : c.defs.map((d) => d.name),
      ),
    )
    const unknown = o.graders.filter((g) => !known.has(g))
    if (unknown.length) {
      throw new CommandError(
        `No selected eval defines ${unknown.map((g) => JSON.stringify(g)).join(', ')} today`,
      )
    }
  }
  const images = !o.dryRun
  const imageUses = !images
    ? []
    : [...currents.values()].flatMap((c) =>
        typeof c === 'string'
          ? []
          : [...new Set(c.defs.map((d) => d.run))].flatMap((run) =>
              run.kind === 'code' &&
              run.env &&
              (!o.graders.length || run.names.some((n) => o.graders.includes(n)))
                ? [{ grader: run.names[0] as string, sandbox: run.env.sandbox }]
                : [],
            ),
      )
  const controller = new AbortController()
  const stop = () => controller.abort()
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  await mkdir(stagingDir, { recursive: true })
  try {
    if (imageUses.length) {
      const { preflight } = await import('./preflight.ts')
      await preflight(
        imageUses.map(({ grader, sandbox }) => {
          const by = `defineGrader("${grader}")`
          return { harness: GRADER_HARNESS, sandbox, setBy: { sandbox: by, harness: by } }
        }),
        { root: config.root, runId: context.runId },
      )
    }
    const plan: PlannedRun[] = []
    for (const { entry, record, evals } of selected) {
      const dir = runDir(config.history.dir, entry.runId)
      const planned: PlannedRun = { entry, record, evals: [] }
      for (const e of evals) {
        const current = currents.get(currentKey(record, e)) as CurrentEval | string
        const attempts: PlannedAttempt[] = []
        for (const a of e.attempts.filter(gradable)) {
          const steps =
            typeof current === 'string'
              ? (a.grades ?? []).map(
                  (g): Step => ({ grader: g.grader, status: 'grader not found', stored: g }),
                )
              : await planAttempt(
                  a,
                  e,
                  current,
                  await keptOf(dir, record, e, a),
                  o.graders,
                  config.root,
                  context.runId,
                  images,
                )
          attempts.push({ attempt: a, steps })
        }
        planned.evals.push({ entry: e, current, attempts })
      }
      plan.push(planned)
    }
    for (const line of await formatPlan(config.root, plan)) o.out(line)
    const all = plan.flatMap((r) => r.evals.flatMap((e) => e.attempts))
    const work = all.filter((p) => p.steps.some((s) => runs(s) || s.status === 'score changed'))
    const refused = new Set(
      all.flatMap((p) => p.steps.filter((s) => s.refused).map((s) => s.grader)),
    )
    const refusedLine = `\n${plural(refused.size, 'grader')} can't run as configured today (${[...refused].join(', ')}): see the plan.`
    if (!work.length) {
      const stuck = all.filter((p) => attemptClass(p.steps) === 'missing').length
      o.out(
        stuck
          ? `\nNothing to regrade: ${plural(stuck, 'attempt')} can't be regraded from what the run kept.`
          : '\nNothing changed: every grade is current.',
      )
      if (refused.size) o.out(refusedLine)
      return refused.size ? 1 : 0
    }
    if (o.dryRun) {
      if (refused.size) o.out(refusedLine)
      return refused.size ? 1 : 0
    }
    const calls = work.some((p) =>
      p.steps.some(
        (s) =>
          runs(s) && (s.def?.run.kind === 'judge' || (s.def?.run.kind === 'code' && s.def.run.env)),
      ),
    )
    if (
      calls &&
      !o.yes &&
      o.confirm &&
      !(await o.confirm('\nThis regrade calls models or starts sandboxes. Regrade now? [y/N] '))
    ) {
      o.out('Canceled: nothing was regraded.')
      return 1
    }
    const { signal } = controller
    const git = await gitAt(config.root)
    let recomputed = 0
    let rescored = 0
    let skipped = 0
    const failures: Failure[] = []
    const refusals: string[] = []
    const before = new Map<string, Array<GradeRecord | undefined>>()
    const after = new Map<string, Array<GradeRecord | undefined>>()
    let total = 0
    let passedBefore = 0
    let passedAfter = 0
    const written: string[] = []
    for (const run of plan) {
      if (signal.aborted) break
      const dir = runDir(config.history.dir, run.entry.runId)
      const regraded: RegradedAttempt[] = []
      for (const e of run.evals) {
        if (typeof e.current === 'string') continue
        for (const p of e.attempts) {
          if (signal.aborted) break
          const { done, failed } = await regradeAttempt(
            dir,
            run.record,
            e.entry,
            e.current,
            p,
            signal,
          )
          for (const [grader, error] of failed) {
            failures.push({ run: run.entry.runId, attempt: p.attempt.key, grader, error })
          }
          total++
          const actions = new Set(done?.actions.map((x) => x.action))
          if (actions.has('recomputed') || actions.has('new')) recomputed++
          else if (actions.has('rescored')) rescored++
          else if (attemptClass(p.steps) === 'missing') skipped++
          if (p.attempt.outcome === 'pass') passedBefore++
          if ((done?.outcome ?? p.attempt.outcome) === 'pass') passedAfter++
          for (const s of p.steps) {
            if (s.status === 'grader not found' || s.status === 'not selected') continue
            const now = done?.grades.find((g) => g.grader === s.grader) ?? s.stored
            before.set(s.grader, [...(before.get(s.grader) ?? []), s.stored])
            after.set(s.grader, [...(after.get(s.grader) ?? []), now])
          }
          if (done) regraded.push(done)
        }
      }
      if (!regraded.length || signal.aborted) continue
      const doc: RegradeRecord = {
        kind: 'reeval-regrade',
        schemaVersion: 1,
        id,
        regradeOf: run.entry.runId,
        at: at.toISOString(),
        reeval: PACKAGE_VERSION,
        git,
        ...(o.graders.length ? { graders: o.graders } : {}),
        attempts: regraded,
      }
      const findings = scanText(`${id}.json`, JSON.stringify(doc, null, 2))
      if (findings.length) {
        refusals.push(
          `Refusing to write ${run.entry.runId}'s regrade: it looks like it contains a secret:`,
          ...findingLines(`${id}.json`, findings).map((l) => `  ${l}`),
        )
        continue
      }
      written.push(await writeRegrade(dir, doc))
    }
    if (signal.aborted) {
      for (const path of written) o.out(`wrote ${path.slice(config.root.length + 1)}`)
      o.out('Canceled: the runs not written above keep their grades.')
      return 130
    }
    const evals = new Set(plan.flatMap((r) => r.evals.map((e) => e.entry.id))).size
    o.out(
      `\nregraded ${plural(evals, 'eval')} in ${plural(plan.length, 'run')}   ${recomputed} recomputed, ${rescored} re-scored, ${skipped} skipped${failures.length ? `, ${plural(failures.length, 'grade')} failed` : ''}\n`,
    )
    const width = Math.max(10, ...[...before.keys()].map((k) => k.length + 2))
    for (const [grader, was] of before) {
      o.out(`${pad(grader, width)}${passed(was, after.get(grader) ?? [])}`)
    }
    o.out(`${pad('attempts', width)}${passedBefore}/${total} → ${passedAfter}/${total} passed`)
    for (const path of written) o.out(`wrote ${path.slice(config.root.length + 1)}`)
    if (failures.length) {
      o.out(
        `\n${plural(failures.length, 'grade')} failed and kept the grade the run had (or none):`,
      )
      for (const f of failures.slice(0, 20)) {
        o.out(`  ${f.grader} on ${f.attempt} (${f.run}): ${f.error}`)
      }
      if (failures.length > 20) o.out(`  and ${failures.length - 20} more`)
    }
    for (const line of refusals) o.out(line)
    if (refused.size) o.out(refusedLine)
    return failures.length || refusals.length || refused.size ? 1 : 0
  } finally {
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
    const { removePrepared } = await import('./sandbox/preflight.ts')
    removePrepared(config.root, context.runId)
    if (imageUses.length) {
      const { cleanupRun } = await import('./sandbox/kinds.ts')
      await cleanupRun(
        context.runId,
        imageUses.map((u) => u.sandbox),
      ).catch(() => {})
    }
    await rm(stagingDir, { recursive: true, force: true })
  }
}

async function gitAt(root: string): Promise<RegradeRecord['git']> {
  const sha = (await lines(root, ['rev-parse', 'HEAD']))?.[0]
  if (!sha) return null
  const status = await lines(root, ['status', '--porcelain'])
  return { sha, dirty: !!status?.length }
}

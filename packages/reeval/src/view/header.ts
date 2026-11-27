import type {
  CellRecord,
  HistoryCell,
  HistoryEntry,
  RunRecord,
  TrialRecord,
} from '../history/types.ts'
import { cellEffort } from './effort.ts'
import { runScope } from './scope.ts'

/** The derived header of one run: what listings, indexes and comparisons need without the record. */
export function runHeader(record: RunRecord, recorded: boolean): HistoryEntry {
  return {
    runId: record.runId,
    recorded,
    status: record.status,
    scope: runScope(record),
    startedAt: record.startedAt,
    durationMs: record.durationMs,
    author: record.author,
    git: record.git
      ? { sha: record.git.sha, branch: record.git.branch, dirty: record.git.dirty }
      : null,
    runner: record.runner.kind,
    ci:
      record.runner.kind === 'ci'
        ? {
            provider: record.runner.provider,
            runUrl: record.runner.runUrl,
            pr: record.runner.pr,
          }
        : null,
    harnesses: record.stack.harnesses.map((h) => h.id),
    summary: record.summary,
    usage: record.cost.usage,
    stack: {
      imageIds: record.stack.images.map((i) => i.id),
      agentClis: [...new Set(record.stack.images.flatMap((i) => (i.agentCli ? [i.agentCli] : [])))],
      harnesses: record.stack.harnesses.map((h) => h.id),
      environments: record.environments.map(
        (e) => `${e.name}@${e.digest.replace(/^sha256:/, '').slice(0, 12)}`,
      ),
      judgeModel: record.stack.judge.model,
      judgeServed: record.stack.judge.resolvedModels,
      judgeVersion: record.stack.judge.version,
      threshold: record.stack.judge.threshold,
      fingerprintScope: record.stack.fingerprintScope,
    },
    evals: record.evals.map((e) => ({
      id: e.id,
      key: e.key,
      slug: e.slug,
      fingerprint: e.fingerprint,
      sources: e.sources,
      ...(e.source ? { source: e.source } : {}),
      ...(e.revision !== undefined ? { revision: e.revision } : {}),
      outcome: e.outcome,
      passRate: e.passRate,
      ...(e.target ? { target: e.target } : {}),
      ...(e.scores ? { scores: e.scores } : {}),
      cells: e.cells.map((c) => historyCell(e.trials, c)),
      ...gradersOf(e.trials),
      ...(e.trials.some((a) => a.regraded) ? { regraded: true as const } : {}),
      ...(e.cases
        ? {
            cases: e.cases.map((k) => {
              const trials = e.trials.filter((a) => a.case === k.key)
              return {
                key: k.key,
                outcome: k.outcome,
                ...(k.verdict ? { verdict: k.verdict } : {}),
                fingerprint: k.fingerprint,
                ...(k.hash ? { hash: k.hash } : {}),
                cells: k.cells.map((c) => historyCell(trials, c)),
              }
            }),
            caseCount: e.caseCount ?? e.cases.length,
            ...(e.lifts?.length
              ? {
                  lifts: e.lifts.map((l) => ({
                    variant: l.variant,
                    vs: l.vs,
                    points: l.points,
                    lo: l.interval.lo,
                    hi: l.interval.hi,
                    ...(l.minLift !== undefined ? { minLift: l.minLift } : {}),
                    outcome: l.outcome,
                  })),
                }
              : {}),
            ...gatedRates(e.cells),
          }
        : {}),
    })),
    ...(record.errors?.length ? { errors: record.errors } : {}),
  }
}

function gradersOf(trials: readonly TrialRecord[]): { graders?: Record<string, string> } {
  const graders: Record<string, string> = {}
  for (const a of trials) {
    for (const g of a.grades ?? []) {
      graders[g.grader] ??= [
        g.fingerprint.digest,
        g.scoreDigest ?? '',
        g.weight,
        g.required ? 'required' : '',
      ].join(':')
    }
  }
  return Object.keys(graders).length ? { graders } : {}
}

/** The cells' rates over the cases that a `{ passRate }` gate gates, when there are any. */
function gatedRates(cells: readonly CellRecord[]) {
  const gated = cells.flatMap(({ key, rate }) =>
    rate?.passRate !== undefined && rate.outcome !== undefined
      ? [{ cell: key, rate: rate.rate, passRate: rate.passRate, outcome: rate.outcome }]
      : [],
  )
  return gated.length ? { rates: gated } : {}
}

function historyCell(trials: readonly TrialRecord[], c: CellRecord): HistoryCell {
  return {
    key: c.key,
    role: c.role,
    ...(c.variant !== undefined ? { variant: c.variant } : {}),
    harness: c.harness,
    model: c.model,
    environment: c.environment,
    environmentDigest: c.environmentDigest,
    gate: c.gate,
    fingerprint: c.fingerprint,
    fingerprintParts: c.fingerprintParts,
    trials: c.trials,
    pass: c.pass,
    fail: c.fail,
    infraError: c.infraError,
    skipped: c.skipped,
    passRate: c.passRate,
    ...(c.scores ? { scores: c.scores } : {}),
    outcome: c.outcome,
    ...(c.bestOf !== undefined ? { bestOf: c.bestOf } : {}),
    effort: cellEffort({ trials: [...trials] }, c.key),
    ...canceledIn(trials, c.key),
    ...(c.lift
      ? {
          lift: {
            vs: c.lift.vs,
            points: c.lift.points,
            lo: c.lift.interval.lo,
            hi: c.lift.interval.hi,
            withinNoise: c.lift.withinNoise,
          },
        }
      : {}),
  }
}

/** A cell's failed trials that the run's interrupt canceled, when it has any. */
function canceledIn(trials: readonly TrialRecord[], cell: string): { canceled?: number } {
  const n = trials.filter(
    (a) => a.cell === cell && a.outcome === 'fail' && a.error?.kind === 'aborted',
  ).length
  return n ? { canceled: n } : {}
}

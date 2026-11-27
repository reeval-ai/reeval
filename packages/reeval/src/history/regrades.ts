// A run's regrades: `reeval regrade` writes each beside the run, in `<run>/regrades/<id>.json`, and
// readers put its trials' grades, scores and outcomes in place of the recorded ones, then roll the
// run up again. The record itself is never rewritten.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { trialScore, scoreFailure } from '../grade/run.ts'
import { randomSuffix } from '../ids.ts'
import { redactSecrets } from '../redact.ts'
import { thresholdOf } from '../target.ts'
import { capMiddle } from '../text.ts'
import type { GradeRecord } from '../types.ts'
import { NewerSchemaError, readableRegrade } from '../view/record.ts'
import { rerollRecord } from './assemble.ts'
import type { EvalEntry, RegradedTrial, RegradeRecord, RunRecord } from './types.ts'

export const REGRADES_DIR = 'regrades'

const REGRADE_FILE = /^\d{8}T\d{6}Z_[0-9a-z]{4}\.json$/

/** `20261126T101500Z_k3f9`: sorting by name sorts by time. */
export const newRegradeId = (at: Date) =>
  `${at
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z')}_${randomSuffix(4)}`

const regradeNames = (runDir: string): string[] => {
  try {
    return readdirSync(join(runDir, REGRADES_DIR))
      .filter((n) => REGRADE_FILE.test(n))
      .sort()
  } catch {
    return []
  }
}

const warned = new Set<string>()

/**
 * The run's regrades, oldest first by `at` and then by id, so two from one second keep one
 * order; one that can't be read is skipped with a warning, once.
 */
export function readRegrades(runDir: string): RegradeRecord[] {
  const out: RegradeRecord[] = []
  for (const name of regradeNames(runDir)) {
    const path = join(runDir, REGRADES_DIR, name)
    try {
      const value = JSON.parse(readFileSync(path, 'utf8')) as RegradeRecord
      if (value?.kind !== 'reeval-regrade') throw new Error('not a reeval regrade')
      out.push(readableRegrade(value, path))
    } catch (error) {
      if (warned.has(path)) continue
      warned.add(path)
      const why =
        error instanceof NewerSchemaError
          ? error.reason
          : `not a readable regrade (${(error as Error).message})`
      process.stderr.write(`warning: skipped ${path}: ${why}\n`)
    }
  }
  return out.sort((x, y) => (x.at === y.at ? (x.id < y.id ? -1 : 1) : x.at < y.at ? -1 : 1))
}

/** A trial's score, outcome and error from `grades`, under its eval's recorded target. */
export function gradedOutcome(
  grades: readonly GradeRecord[],
  target: EvalEntry['target'],
): Pick<RegradedTrial, 'score' | 'outcome' | 'error'> {
  const score = trialScore(grades)
  const threshold = thresholdOf(target)
  const pass = score >= threshold
  return {
    score,
    outcome: pass ? 'pass' : 'fail',
    error: pass
      ? null
      : {
          kind: 'assertion',
          message: capMiddle(redactSecrets(scoreFailure(score, threshold, grades))),
        },
  }
}

const APPLIED = new Set(['rescored', 'recomputed', 'new'])

/** What changes when a regrade lands: each file's name and size, for a reader's cache. */
export function regradesStamp(runDir: string): string {
  return regradeNames(runDir)
    .map((n) => `${n}:${statSync(join(runDir, REGRADES_DIR, n)).size}`)
    .join(',')
}

/**
 * The record as its regrades left it, each in order: a trial one regraded takes the grades it
 * rescored, recomputed or added, over the grades before it, and is scored again under its eval's
 * target; then the run is rolled up again. A regrade of trials the record doesn't have changes
 * nothing.
 */
export function applyRegrades(record: RunRecord, regrades: readonly RegradeRecord[]): RunRecord {
  const mine = regrades.filter((r) => r.regradeOf === record.runId)
  if (!mine.length) return record
  const byKey = new Map(
    record.evals.flatMap((e) => e.trials.map((a) => [a.key, { a, e }] as const)),
  )
  const notes: NonNullable<RunRecord['regrades']> = []
  for (const r of mine) {
    const changed: string[] = []
    for (const regraded of r.trials) {
      const found = byKey.get(regraded.key)
      if (!found) continue
      const { a, e } = found
      const grades = [...(a.grades ?? [])]
      for (const { grader, action } of regraded.actions) {
        if (!APPLIED.has(action)) continue
        const now = regraded.grades.find((g) => g.grader === grader)
        if (!now) continue
        const at = grades.findIndex((g) => g.grader === grader)
        if (at < 0) grades.push(now)
        else grades[at] = now
      }
      Object.assign(a, { grades, ...gradedOutcome(grades, e.target) })
      a.regraded = r.id
      changed.push(a.key)
    }
    notes.push({ id: r.id, at: r.at, trials: changed })
  }
  return { ...rerollRecord(record), regrades: notes }
}

/** Writes a regrade into its run's `regrades/` folder, whole. */
export async function writeRegrade(runDir: string, regrade: RegradeRecord): Promise<string> {
  const dir = join(runDir, REGRADES_DIR)
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${regrade.id}.json`)
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify(regrade, null, 2)}\n`)
  await rename(tmp, path)
  return path
}

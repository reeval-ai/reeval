// The record corpus's real-harness runs from the real-agent contract (real.yml), trial by trial:
// `real-e2e-pairs` holds two recorded runs of one eval per harness, and `real-contract` one run of
// the harness contract per harness, with passing checks and failing canaries. Key-free readers of
// real trajectories and diffs build on these.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type PairTrial, pairsOf } from '../../src/compare/pairs.ts'
import { answerQuestion } from '../../src/compare/questions.ts'
import type { TrialRecord, EvalEntry, RunRecord } from '../../src/history/types.ts'
import type { BlindPair, CompareAnswer, FakeVote } from '../../src/types.ts'
import { readableRecord } from '../../src/view/record.ts'
import { corpusEntries } from './corpus.ts'

export const REAL_ENTRIES = ['real-e2e-pairs', 'real-contract'] as const
export type RealEntry = (typeof REAL_ENTRIES)[number]

/** The harnesses both entries hold, by `harnessKind`. */
export const REAL_HARNESSES = ['cursor', 'claude-code', 'codex'] as const

export type RealTrial = {
  entry: RealEntry
  runId: string
  /** The run's record, read the way reeval reads it. */
  record: RunRecord
  eval: EvalEntry
  trial: TrialRecord
  /** The trial's cell's `harnessKind`, e.g. `cursor`. */
  harness: string
  /** Absolute paths into the corpus; absent when the trial never reached the agent. */
  trajectory?: string
  diff?: string
}

/** Every trial of the real-harness entries (or the one named), runs oldest first. */
export function realTrials(only?: RealEntry): RealTrial[] {
  const out: RealTrial[] = []
  for (const entry of corpusEntries()) {
    const name = entry.name as RealEntry
    if (!REAL_ENTRIES.includes(name) || (only && only !== name)) continue
    for (const run of entry.runs) {
      const record = readableRecord(structuredClone(run.raw) as never)
      const dir = join(entry.dir, 'evals/.history', run.runId)
      for (const e of record.evals) {
        for (const a of e.trials) {
          const cell = e.cells.find((c) => c.key === a.cell)
          out.push({
            entry: name,
            runId: run.runId,
            record,
            eval: e,
            trial: a,
            harness: cell?.harnessKind ?? 'unknown',
            ...(a.files.trajectory && { trajectory: join(dir, a.files.trajectory.path) }),
            ...(a.files.diff && { diff: join(dir, a.files.diff.path) }),
          })
        }
      }
    }
  }
  return out
}

/** The environments `real-e2e-pairs`' two runs of each harness stand in for, oldest first. */
export const E2E_ARMS = ['first-run', 'second-run'] as const

/**
 * `real-e2e-pairs` as compare-question sides: each harness's two recorded runs as two environments of
 * one run, so the real diffs give within and across pairs.
 */
export function e2ePairSides(): PairTrial[] {
  const trials = realTrials('real-e2e-pairs')
  return REAL_HARNESSES.flatMap((harness) => {
    const mine = trials.filter((a) => a.harness === harness)
    if (mine.length !== 2) throw new Error(`${mine.length} recorded runs on ${harness}, not 2`)
    return mine.map((a, i) => ({
      harness,
      environment: E2E_ARMS[i] as string,
      run: 1,
      diff: readFileSync(a.diff as string, 'utf8'),
      checksPassed: a.trial.outcome === 'pass',
      turns: a.trial.turns.map((t) => ({ prompt: t.prompt })),
      id: a.trial.key,
    }))
  })
}

/** Codex ends hello.txt with a newline; Cursor and Claude Code don't. */
const endsWithNewline = (diff: string) => !diff.includes('No newline at end of file')

/** A pick that favors the diff whose hello.txt ends with a newline, and ties otherwise. */
export const newlineVote = (p: BlindPair): FakeVote =>
  endsWithNewline(p.a.diff ?? '') === endsWithNewline(p.b.diff ?? '')
    ? 'tie'
    : endsWithNewline(p.a.diff ?? '')
      ? 'A'
      : 'B'

/** A question about the real diffs, answered by `newlineVote` over every pair of them. */
export const e2eNewlineAnswer = (): Promise<CompareAnswer> =>
  answerQuestion({
    question: 'Which ends hello.txt with a newline?',
    model: { kind: 'fake-analysis', vote: newlineVote },
    pairs: pairsOf(e2ePairSides()),
    maxInputTokens: 20_000,
    maxOutputTokens: 100,
    state: { task: true, diff: true },
  })

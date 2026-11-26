// The output goldens, test/fixtures/output/<name>.txt: each one layout, rendered from the evals it
// names in a corpus run, and each `reeval compare` block, from two corpus runs.
// test/output.test.ts holds the files to these, and `output:preview all` prints them.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunRecord } from '../../src/history/types.ts'
import type { CompareInput } from '../../src/ui/compare-layout.ts'
import { render } from '../../src/ui/layout.ts'
import { compare, newRows, stackChanges } from '../../src/view/compare.ts'
import { runHeader } from '../../src/view/header.ts'
import { readableRecord } from '../../src/view/record.ts'
import { type EvalResult, type SuiteResult, suiteResult, tallyKey } from '../../src/view/suite.ts'
import { CORPUS_DIR, corpusEntries } from '../schema/corpus.ts'

export type Golden = {
  name: string
  /** The corpus entry, and its run (the newest when unset). */
  entry: string
  run?: string
  /** The eval or family ids, or eval files, to keep; every eval when unset. */
  evals?: string[]
  /** Rendered as `-v` prints it. */
  verbose?: boolean
}

const RESULTS = [
  'writes-greet-js',
  'greets-in-french',
  'explains-why-greet-js-fails',
  'reads-the-fixture-repo',
  'starts-its-sandbox',
  'greets-in-welsh',
  'greets-in-klingon',
]
const MEASURE = ['greets-in-the-house-style', 'keeps-the-plain-greeting', 'greets-once']

/** One per layout, from the with-targets entry (scripts/output/project) and real harness runs. */
export const GOLDENS: Golden[] = [
  { name: 'results', entry: 'with-targets', evals: RESULTS },
  { name: 'results-verbose', entry: 'with-targets', evals: RESULTS, verbose: true },
  { name: 'results-real', entry: 'real-contract' },
  { name: 'measure-a-change', entry: 'with-targets', evals: MEASURE },
  { name: 'measure-a-change-verbose', entry: 'with-targets', evals: MEASURE, verbose: true },
  {
    name: 'compare-harnesses',
    entry: 'with-targets',
    evals: ['greets-in-the-house-style-on-each-agent'],
  },
  { name: 'compare-harnesses-real', entry: 'real-harnesses' },
  { name: 'both', entry: 'with-targets', evals: ['learns-the-house-style-from-the-skill'] },
  { name: 'family', entry: 'with-targets', evals: ['adds-a-button-that-builds', 'choose'] },
  { name: 'family-with-change', entry: 'with-targets', evals: ['greets-in-the-house-style-2'] },
  {
    name: 'family-with-change-verbose',
    entry: 'with-targets',
    evals: ['greets-in-the-house-style-2'],
    verbose: true,
  },
  { name: 'suite', entry: 'with-targets' },
]

export const OUTPUT_DIR = join(CORPUS_DIR, '..', 'output')

function tallyOf(evals: EvalResult[], errors: number): SuiteResult['tally'] {
  const tally: SuiteResult['tally'] = {
    errors,
    evals: 0,
    onTarget: 0,
    below: 0,
    reportOnly: 0,
    infraError: 0,
    canceled: 0,
    skipped: 0,
  }
  for (const e of evals) {
    tally[tallyKey(e)]++
    tally.evals++
  }
  return tally
}

function goldenRun(g: Golden) {
  const entry = corpusEntries().find((e) => e.name === g.entry)
  if (!entry) throw new Error(`No corpus entry ${g.entry}`)
  const run = g.run ? entry.runs.find((r) => r.runId === g.run) : entry.runs.at(-1)
  if (!run) throw new Error(`No run ${g.run ?? '(newest)'} in corpus entry ${g.entry}`)
  return run
}

/** The golden's lines. */
export function goldenRender(g: Golden, o: { color?: boolean; verbose?: boolean } = {}): string[] {
  return render(goldenSuite(g), null, { color: !!o.color, verbose: !!o.verbose || !!g.verbose })
}

/** The golden's run as a SuiteResult, cut down to its evals, the tally counting only those. */
export function goldenSuite(g: Golden): SuiteResult {
  const run = goldenRun(g)
  const suite = suiteResult(
    readableRecord(JSON.parse(readFileSync(run.file, 'utf8')) as RunRecord, run.file),
  )
  if (!g.evals) return suite
  const keep = new Set(g.evals)
  const files = suite.files
    .map((f) => ({ ...f, evals: f.evals.filter((e) => keep.has(e.id) || keep.has(f.path)) }))
    .filter((f) => f.evals.length)
  const missing = g.evals.filter(
    (id) => !files.some((f) => f.path === id || f.evals.some((e) => e.id === id)),
  )
  if (missing.length) throw new Error(`Golden ${g.name}: no eval ${missing.join(', ')}`)
  return {
    ...suite,
    files,
    tally: tallyOf(
      files.flatMap((f) => f.evals),
      suite.errors.length,
    ),
  }
}

export type CompareGolden = {
  name: string
  /** The corpus entry: its oldest run is base and its newest head, or head alone with `noBaseline`. */
  entry: string
  noBaseline?: boolean
  /** The eval ids whose rows to keep; every row when unset. */
  evals?: string[]
  verbose?: boolean
}

const compared = (...names: string[]) => names.map((n) => `evals/${n}`)

/** One per block `reeval compare` prints, from the with-compare entry (scripts/output/compare). */
export const COMPARE_GOLDENS: CompareGolden[] = [
  {
    name: 'compare-regressed',
    entry: 'with-compare',
    evals: compared('greet.eval.ts › greets in the house style'),
  },
  {
    name: 'compare-fixed',
    entry: 'with-compare',
    evals: ['evals/buttons.eval.ts › adds a button that builds'],
  },
  {
    name: 'compare-cant-compare',
    entry: 'with-compare',
    evals: compared('billing.eval.ts › bills in minor units with the billing doc'),
  },
  {
    name: 'compare-new-and-removed',
    entry: 'with-compare',
    evals: compared('greet.eval.ts › greets in Spanish', 'greet.eval.ts › greets in German'),
  },
  {
    name: 'compare-same-collapsed',
    entry: 'with-compare',
    evals: compared('greet.eval.ts › writes greet.js', 'greet.eval.ts › greets in French'),
  },
  { name: 'compare-no-baseline', entry: 'with-compare', noBaseline: true },
  { name: 'compare', entry: 'with-compare' },
  { name: 'compare-verbose', entry: 'with-compare', verbose: true },
]

const fromFile = (file: string) =>
  readableRecord(JSON.parse(readFileSync(file, 'utf8')) as RunRecord, file)

/** Two recorded runs as `reeval compare` reads them; head alone when `base` is null. */
export function compareInput(base: RunRecord | null, head: RunRecord): CompareInput {
  const headEntry = runHeader(head, true)
  const baseEntry = base ? runHeader(base, true) : null
  const rows = baseEntry ? compare(baseEntry, headEntry) : newRows(headEntry)
  return {
    base: base ? { runId: base.runId, suite: suiteResult(base) } : null,
    head: { runId: head.runId, suite: suiteResult(head) },
    rows,
    changes: baseEntry ? stackChanges(baseEntry, headEntry) : [],
  }
}

/** The golden's compare, its rows cut down to its evals. */
export function goldenCompare(g: CompareGolden): CompareInput {
  const entry = corpusEntries().find((e) => e.name === g.entry)
  const [first, last] = [entry?.runs[0], entry?.runs.at(-1)]
  if (!first || !last || first === last) throw new Error(`Corpus entry ${g.entry} needs two runs`)
  const input = compareInput(g.noBaseline ? null : fromFile(first.file), fromFile(last.file))
  if (!g.evals) return input
  const keep = new Set(g.evals)
  const missing = g.evals.filter((id) => !input.rows.some((r) => r.id === id))
  if (missing.length) throw new Error(`Golden ${g.name}: no row ${missing.join(', ')}`)
  return { ...input, rows: input.rows.filter((r) => keep.has(r.id)) }
}

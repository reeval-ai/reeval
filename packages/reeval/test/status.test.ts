import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { evalRow } from '../src/ui/status.ts'
import { suiteResult } from '../src/view/suite.ts'
import { fakeConfig, project, readRun, runCli } from './helpers.ts'
import { copyOut } from './support/examples.ts'

const EVALS = `import { defineEnvironment, evaluate, expect } from 'reeval'
const plain = defineEnvironment('plain', {})
const marked = defineEnvironment('marked', { files: { 'marker.txt': 'ok\\n' } })

evaluate('passes', async (c) => {
  await c.send('go')
  expect(1, 'one').toBe(1)
})

evaluate('two checks fail', { runs: 2, gate: { passRate: 0.5 } }, async (c) => {
  await c.send('go')
  if (c.attempt.n === 1) expect(1, 'first check').toBe(2)
  else expect('a', 'second check').toBe('b')
})

evaluate('throws', async (c) => {
  await c.send('go')
  throw new Error('the fixture is missing')
})

evaluate('compares', { runs: 1, compare: { control: plain, variants: [marked] } }, async (c) => {
  await c.send('go')
  expect(c.attempt.cell.role === 'variant', 'uses the marker').toBe(true)
})

evaluate('colors', { cases: [{ id: 'red' }, { id: 'green' }, { id: 'blue' }] }, async (c, { id }) => {
  await c.send('go')
  expect(id, 'is green').toBe('green')
})
`

/** From the first eval to the tally, with the run's wall time masked. */
const listOf = (stdout: string) => {
  const start = stdout.search(/^[A-Z][A-Z ]{12} {2}\S/m)
  const end = stdout.indexOf('\nBrowse it:')
  assert.ok(start >= 0 && end > start, stdout)
  return stdout.slice(start, end)
}

const PLAIN = `PASS           passes
               100% passed · 1 of 1 attempt

FAIL           two checks fail
               0% passed · 0 of 2 attempts
               failed check, 1 of 2: first check
                 expected 1 to be 2 // Object.is equality
                 at evals/s.eval.ts:12
               failed check, 1 of 2: second check
                 expected 'a' to be 'b' // Object.is equality
                 at evals/s.eval.ts:13

FAIL           throws
               0% passed · 0 of 1 attempt
               error, 1 of 1: the fixture is missing

PASS           compares
               plain 0% vs marked 100%: too few runs · 0 of 1 vs 1 of 1 attempt
               plain   0%    0 of 1  baseline
               marked  100%  1 of 1  too few runs
               failed check, 1 of 2, all on plain, not gated: uses the marker
                 expected false to be true // Object.is equality
                 at evals/s.eval.ts:23
               Next: at evals/s.eval.ts:21, set runs: 4, where a difference this size would hold
               (concern) The marked variant passed 1 of 1 run and the control 0 of 1: better by 100 points, but on too few runs for the difference to hold.

FAIL           colors
               33% passed · 1 of 3 attempts
               red    0%    0 of 1
               green  100%  1 of 1
               blue   0%    0 of 1
               failed check, 2 of 3: is green
                 expected 'red' to be 'green' // Object.is equality
                 at evals/s.eval.ts:28

Evals: 3 fail · 2 pass
`

test('the run-end list: a block per eval, with its failures and what to do next', async () => {
  const p = await project('status-list', {
    'reeval.config.ts': fakeConfig({ harness: '{ turnMs: 1000 }' }),
    'evals/s.eval.ts': EVALS,
  })
  const plain = await runCli(p.dir, ['run', '--ui', 'plain'])
  assert.equal(plain.code, 1, plain.stdout + plain.stderr)
  assert.equal(listOf(plain.stdout), PLAIN)
  // An agent reads the same blocks with the statistics -v adds to them.
  const agent = await runCli(p.dir, ['run', '--ui', 'agent'])
  assert.equal(agent.code, 1, agent.stdout + agent.stderr)
  const agentList = listOf(agent.stdout)
  assert.match(agentList, /^ {15}0% passed, 95% CI 0% to 66%$/m)
  assert.match(agentList, /^ {15}marked \+100 pts \(95% CI -12 pts to \+100 pts\)$/m)
  assert.equal(
    agentList.replace(/^ {15}(\d+% passed, 95% CI|marked \+100 pts|task average).*\n/gm, ''),
    PLAIN,
  )
})

const FASTER = `import { defineEnvironment, evaluate, expect } from 'reeval'
const plain = defineEnvironment('plain', {})
const marked = defineEnvironment('marked', { files: { 'marker.txt': 'ok\\n' } })

evaluate('compares', { runs: 4, compare: { control: plain, variants: [marked] } }, async (c) => {
  for (let i = 0; i < (c.attempt.cell.role === 'variant' ? 1 : 5); i++) await c.send('go')
  expect(1, 'one').toBe(1)
})
`

const idOf = (stdout: string) => /Run: +(\S+)/.exec(stdout)?.[1] ?? ''

test('a compare whose effort holds prints its comparison, which every reader shares, and no tie remark', async () => {
  const p = await project('status-measures', {
    'reeval.config.ts': fakeConfig({ harness: '{ delayMs: 150 }' }),
    'evals/s.eval.ts': FASTER,
  })
  const run = await runCli(p.dir, ['run', '--ui', 'plain'])
  assert.equal(run.code, 0, run.stdout + run.stderr)
  const list = listOf(run.stdout)
  assert.match(
    list,
    /^ {15}plain {3}100% {2}4 of 4 {2}baseline\n {15}marked {2}100% {2}4 of 4 {2}same$/m,
  )
  assert.doesNotMatch(list, /too few runs|can't tell them apart|looks different/)
  const summary = readFileSync(join(p.dir, '.reeval/runs', idOf(run.stdout), 'summary.md'), 'utf8')
  const time = (arm: string) =>
    Number(new RegExp(`^\\| ${arm} \\| [^|]+ \\| [^|]+ \\| ([\\d.]+)s \\|`, 'm').exec(summary)?.[1])
  assert.ok(time('plain') > 3 * time('marked'), summary)
  const rows = await runCli(p.dir, ['query', 'measure_effects', '--json'])
  assert.equal(rows.code, 0, rows.stderr)
  const effects = JSON.parse(rows.stdout) as Array<Record<string, unknown>>
  assert.deepEqual(
    effects.map((r) => [r.measure, r.verdict, r.variant, r.control]),
    [
      ['pass', 'same', 'marked', 'fake/plain/fake'],
      ['tools', 'same', 'marked', 'fake/plain/fake'],
      ['agentMs', 'better', 'marked', 'fake/plain/fake'],
      ['check', 'same', 'marked', 'fake/plain/fake'],
    ],
  )
  const again = await runCli(p.dir, ['run', '--ui', 'plain'])
  assert.equal(again.code, 0, again.stdout + again.stderr)
  const compare = await runCli(p.dir, ['compare', idOf(run.stdout), idOf(again.stdout), '-v'])
  assert.equal(compare.code, 0, compare.stdout + compare.stderr)
  assert.match(
    compare.stdout,
    /fake\/marked\/fake vs baseline +same pass rate · [4-6](\.\d)?× faster → same pass rate · [4-6](\.\d)?× faster/,
  )
})

const IDENTICAL = `import { defineEnvironment, evaluate, expect } from 'reeval'
const plain = defineEnvironment('plain', {})
const marked = defineEnvironment('marked', { files: { 'marker.txt': 'ok\\n' } })

evaluate('compares', { runs: 4, compare: { control: plain, variants: [marked] } }, async (c) => {
  await c.send('go')
  expect(1, 'one').toBe(1)
})
`

test('identical arms are a tie: make the task harder', async () => {
  const p = await project('status-identical', {
    'reeval.config.ts': fakeConfig({ harness: '{ turnMs: 1000 }' }),
    'evals/s.eval.ts': IDENTICAL,
  })
  const run = await runCli(p.dir, ['run', '--ui', 'plain'])
  assert.equal(run.code, 0, run.stdout + run.stderr)
  assert.match(
    listOf(run.stdout),
    /passed every run \(4 of 4 and 4 of 4\): the task can't tell them apart, since both always pass\./,
  )
  assert.match(
    listOf(run.stdout),
    /^ {15}Next: at evals\/s\.eval\.ts:\d+, make the task harder, so the control can fail$/m,
  )
  const attempts = readRun(p.dir).run.evals.flatMap((e) => e.attempts)
  assert.deepEqual(
    new Set(attempts.map((a) => a.timings.agentMs)),
    new Set([1000]),
    'turnMs is the agent time',
  )
})

test('with-compare-questions, whose question picked the variant 4 of 4, names the runs that would confirm it', async () => {
  const dir = await copyOut('with-compare-questions')
  const config = join(dir, 'reeval.config.ts')
  // Agent time stays the same, so the question is the only lean.
  writeFileSync(
    config,
    readFileSync(config, 'utf8').replace('fakeHarness({', 'fakeHarness({ turnMs: 1000,'),
  )
  const run = await runCli(dir, ['run', '--ui', 'plain', '-v'], { timeoutMs: 300_000 })
  assert.equal(run.code, 0, run.stdout + run.stderr)
  assert.match(
    run.stdout,
    /but the variant looks different: (.+ and )?"Which divide\(\) says more clearly what went wrong when b is…" picked the variant in 8 of 8 votes \(4 of 4 decisive pairs\); about \d+ runs a side would confirm it\./,
  )
  assert.match(
    run.stdout,
    /^ {17}math 0 of 8, errors 8 of 8, 0 ties$/m,
    'the standings count the same votes',
  )
  assert.doesNotMatch(run.stdout, /make the task harder/)
  const brief = await runCli(dir, ['run', '--ui', 'plain'], { timeoutMs: 300_000 })
  assert.match(
    brief.stdout,
    /^ {15}Next: at with-compare-questions\.eval\.ts:\d+, set runs: \d+, where the soonest of these would hold$/m,
  )
})

test('with-effort at runs: 3, too few for a rank test, still names its speedup', async () => {
  const dir = await copyOut('with-effort')
  const file = join(dir, 'with-effort.eval.ts')
  writeFileSync(file, readFileSync(file, 'utf8').replace('runs: 4', 'runs: 3'))
  const run = await runCli(dir, ['run', '--ui', 'plain'], { timeoutMs: 300_000 })
  assert.equal(run.code, 0, run.stdout + run.stderr)
  assert.match(
    run.stdout,
    /3 runs a side can't rule out a difference of up to \d+ points\. It runs [\d.]+× faster, but 3 runs a side can't confirm it; 4 is the least that can\.$/m,
  )
  const verbose = await runCli(dir, ['run', '--ui', 'plain', '-v'], { timeoutMs: 300_000 })
  assert.match(verbose.stdout, /It runs [\d.]+× faster, but 3 runs a side can't confirm it/)
  assert.doesNotMatch(verbose.stdout, /\blooks [\d.]+×/, 'a lean is marked after it, not before')
})

test("a compare's control line names the harnesses when they disagree, with or without variants", async () => {
  const p = await project('status-control-disagrees', {
    'reeval.config.ts': `import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'
import { fakeSandbox } from 'reeval/sandbox'
export default defineConfig({
  include: ['evals/*.eval.ts'],
  harnesses: [fakeHarness({ id: 'left' }), fakeHarness({ id: 'right' })],
  sandbox: fakeSandbox(),
})
`,
    'evals/c.eval.ts': `import { defineEnvironment, evaluate, expect } from 'reeval'
const plain = defineEnvironment('plain', {})
const marked = defineEnvironment('marked', { files: { 'marker.txt': 'ok\\n' } })
evaluate('compares', { runs: 1, compare: { control: plain, variants: [marked] } }, async (c) => {
  await c.send('go')
  expect(c.attempt.cell.key.startsWith('left/'), 'on left').toBe(true)
})
`,
  })
  await runCli(p.dir, ['run', '--ui', 'plain'])
  const { run } = readRun(p.dir)
  const [e] = suiteResult(run).files.flatMap((f) => f.evals)
  assert.ok(e?.cells)
  const text = (row: { detail: { text: string }[] }) => row.detail.map((d) => d.text).join('\n')
  assert.match(
    text(evalRow(run, e, [])),
    /^plain \(control\) {2}1 of 2 \(left 1 of 1, right 0 of 1\)$/m,
  )
  const alone = { ...e, cells: e.cells.filter((c) => c.variant === null) }
  assert.match(
    text(evalRow(run, alone, [])),
    /^Control plain passed 1 of 2 \(left 1 of 1, right 0 of 1\)\.$/m,
  )
})

test('under -v a judged check reads as its judge score, marked (leans), not again as its pass rate', async () => {
  const p = await project('status-judged-lean', {
    'reeval.config.ts': fakeConfig(),
    'evals/c.eval.ts': `import { defineEnvironment, evaluate, expect } from 'reeval'
const plain = defineEnvironment('plain', {})
const marked = defineEnvironment('marked', { files: { 'marker.txt': 'ok\\n' } })
evaluate('compares', { runs: 1, compare: { control: plain, variants: [marked] } }, async (c) => {
  await c.send('go')
  expect(c.attempt.cell.role === 'variant', 'tidy').toBe(true)
})
`,
  })
  await runCli(p.dir, ['run', '--ui', 'plain'])
  const { run } = readRun(p.dir)
  const [e] = suiteResult(run).files.flatMap((f) => f.evals)
  assert.ok(e?.cells)
  const lean = {
    variant: 1,
    control: 0,
    lo: null,
    hi: null,
    p: 0.3,
    verdict: 'leans',
    leaning: 'better',
    needed: 4,
    unit: 'runs',
    short: { now: 1, at: 4 },
  } as const
  const measures = [
    { ...lean, measure: 'judge', label: 'tidy', estimate: 0.97, text: 'judge "tidy" +0.97' },
    { ...lean, measure: 'check', label: 'tidy', estimate: 1, text: '"tidy" +100 pts' },
    { ...lean, measure: 'check', label: 'builds', estimate: 1, text: '"builds" +100 pts' },
  ]
  const cells = e.cells.map((c) => (c.variant ? { ...c, measures } : c))
  const row = evalRow(run, { ...e, cells, pooled: [] }, [], true)
  const variant = row.detail.map((d) => d.text).find((t) => t.startsWith('marked'))
  assert.match(
    variant ?? '',
    /helped +judge "tidy" \+0\.97 \(leans\) · "builds" \+100 pts \(leans\)$/,
  )
})

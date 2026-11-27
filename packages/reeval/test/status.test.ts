import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { evalRow } from '../src/ui/status.ts'
import { scorePercent } from '../src/view/report/format.ts'
import { suiteResult } from '../src/view/suite.ts'
import { fakeConfig, project, readRun, runCli } from './helpers.ts'
import { copyOut } from './support/examples.ts'

const ENVS = `import { defineEnvironment } from 'reeval'
export const plain = defineEnvironment('plain', {})
export const marked = defineEnvironment('marked', { files: { 'marker.txt': 'ok\\n' } })
`

const EVALS = {
  'evals/envs.ts': ENVS,
  'evals/passes.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('go')
    assert.equal(1, 1, 'one')
  },
})
`,
  'evals/two-checks-fail.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  trials: 2,
  async task(c) {
    await c.send('go')
    if (c.trial.n === 1) assert.equal(1, 2, 'first check')
    else assert.equal('a', 'b', 'second check')
  },
})
`,
  'evals/throws.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('go')
    throw new Error('the fixture is missing')
  },
})
`,
  'evals/compares.eval.ts': `import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { marked, plain } from './envs.ts'
export default defineEval({
  trials: 1,
  compare: { baseline: plain, variants: [marked] },
  graders: [hasFile('marker.txt')],
  async task(c) {
    await c.send('go')
  },
})
`,
  'evals/colors.eval.ts': `import { defineEval, defineGrader } from 'reeval'
const green = defineGrader('is-green', { grade: (c) => c.case.key === 'green' })
export default defineEval({
  cases: [{ key: 'red' }, { key: 'green' }, { key: 'blue' }],
  graders: [green],
  async task(c) {
    await c.send('go')
  },
})
`,
}

/** From the file heading to the tally, with the run's time masked. */
const listOf = (stdout: string) => {
  const start = stdout.search(/^evals\//m)
  const end = stdout.indexOf('\nBrowse it:')
  assert.ok(start >= 0 && end > start, stdout)
  return stdout
    .slice(start, end)
    .replace(/^Done in \S+/m, 'Done in <time>')
    .replace(/Snapshot: \S+/g, 'Snapshot: <path>')
}

const PLAIN = `evals/colors.eval.ts
└─ ✗ colors  mean 33% · 1/3 trials at 100%, worst 0%  regression(1)
     #red   0%  is-green 0%
     #blue  0%  is-green 0%

evals/compares.eval.ts
└─ ✓ compares  mean 100% · 1/1 trial at 100%  regression(1)
     environment      pass
     plain            0 of 1
       error  score 0.00 below 1: has-file:marker.txt scored 0.00
     marked           1 of 1  helped
     Worth knowing: 1 trial per side; set trials: 4 at evals/compares.eval.ts to confirm this difference.

evals/passes.eval.ts
└─ ✓ passes  mean 100% · 1/1 trial at 100%  regression(1)

evals/throws.eval.ts
└─ ✗ throws  mean 0% · 0/1 trial at 100%  regression(1)
     #1  0%  the fixture is missing
       after turn 1
       at task (evals/throws.eval.ts:5:11)

evals/two-checks-fail.eval.ts
└─ ✗ two-checks-fail  mean 0% · 0/2 trials at 100%, worst 0%  regression(1)
     #1  0%  first check 1 !== 2
       after turn 1
       at task (evals/two-checks-fail.eval.ts:7:42)
     #2  0%  second check 'a' !== 'b'
       after turn 1
       at task (evals/two-checks-fail.eval.ts:8:21)

Done in <time> · 5 evals · 2 on target · 3 below`

test('the status list: one line a pass, and a sentence for each way an eval went', async () => {
  const p = await project('status-list', {
    'reeval.config.ts': fakeConfig({ harness: '{ turnMs: 1000 }' }),
    ...EVALS,
  })
  const plain = await runCli(p.dir, ['run', '--ui', 'plain'])
  assert.equal(plain.code, 1, plain.stdout + plain.stderr)
  assert.equal(listOf(plain.stdout), PLAIN)
  // An agent reads the same sentences without the tree's glyphs, with the detail -v adds to them:
  // each failure's snapshot and each remark's whole sentence.
  const agent = await runCli(p.dir, ['run', '--ui', 'agent'])
  assert.equal(agent.code, 1, agent.stdout + agent.stderr)
  const agentList = listOf(agent.stdout)
  assert.match(agentList, /^ {4}Snapshot: <path> \(\+1 more in summary\.md\)$/m)
  assert.match(agentList, /^ {4}Snapshot: <path>$/m)
  const remark = 'Worth knowing: 1 trial per side; set trials: 4 at evals/compares.eval.ts'
  const whole =
    'Worth knowing: The marked variant passed 1 of 1 trial and the baseline 0 of 1: better by 100 points, but on too few trials for the difference to hold. Fix at evals/compares.eval.ts: set trials: 4, where a difference this size would hold.'
  assert.ok(agentList.includes(`    ${whole}\n`), agentList)
  assert.equal(
    agentList
      .replace(/^ {4}Snapshot: .*\n/gm, '')
      .replace(whole, `${remark} to confirm this difference.`),
    PLAIN.replace(/^[├└]─ /gm, '  ').replace(/^[│ ] {4}/gm, '    '),
  )
})

const FASTER = `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
const plain = defineEnvironment('plain', {})
const marked = defineEnvironment('marked', {})

export default defineEval({
  trials: 4, compare: { baseline: plain, variants: [marked] },
  async task(c) {
    for (let i = 0; i < (c.trial.cell.role === 'variant' ? 1 : 5); i++) await c.send('go')
    assert.equal(1, 1, 'one')
  },
})
`

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
    /^ {5}environment +pass +vs baseline\n {5}plain +4 of 4\n {5}marked +4 of 4 {2}same {2}[4-6](\.\d)?× faster\n {5}effort +tools +time\n {5}plain +0 +([\d.]+)s\n {5}marked +0 +([\d.]+)s$/m,
  )
  const [, slow = '0', fast = '0'] =
    /plain +0 +([\d.]+)s\n {5}marked +0 +([\d.]+)s$/m.exec(list) ?? []
  assert.ok(Number(fast) * 3 < Number(slow), list)
  const show = await runCli(p.dir, ['show', /Run: +(\S+)/.exec(run.stdout)?.[1] ?? ''])
  assert.equal(show.code, 0, show.stderr)
  const environments = list
    .split('\n')
    .filter((l) => l.startsWith('     '))
    .map((l) => l.trim())
  assert.ok(
    environments.length > 0 && environments.every((l) => show.stdout.includes(l)),
    show.stdout,
  )
  assert.doesNotMatch(list, /Worth knowing|can't tell them apart|looks different/)
  const rows = await runCli(p.dir, ['query', 'measure_effects', '--json'])
  assert.equal(rows.code, 0, rows.stderr)
  const effects = JSON.parse(rows.stdout) as Array<Record<string, unknown>>
  assert.deepEqual(
    effects.map((r) => [r.measure, r.verdict, r.variant, r.baseline]),
    [
      ['pass', 'same', 'marked', 'fake/plain/fake'],
      ['tools', 'same', 'marked', 'fake/plain/fake'],
      ['agentMs', 'better', 'marked', 'fake/plain/fake'],
    ],
  )
  const again = await runCli(p.dir, ['run', '--ui', 'plain'])
  assert.equal(again.code, 0, again.stdout + again.stderr)
  const idOf = (stdout: string) => /Run: +(\S+)/.exec(stdout)?.[1] ?? ''
  const compare = await runCli(p.dir, ['compare', idOf(run.stdout), idOf(again.stdout), '-v'])
  assert.equal(compare.code, 0, compare.stdout + compare.stderr)
  assert.match(
    compare.stdout,
    /fake\/marked\/fake vs baseline +same pass rate · [4-6](\.\d)?× faster → same pass rate · [4-6](\.\d)?× faster/,
  )
})

const IDENTICAL = `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
const plain = defineEnvironment('plain', {})
const marked = defineEnvironment('marked', { files: { 'marker.txt': 'ok\\n' } })

export default defineEval({
  trials: 4, compare: { baseline: plain, variants: [marked] },
  async task(c) {
    await c.send('go')
    assert.equal(1, 1, 'one')
  },
})
`

test('identical environments are a tie: make the task harder', async () => {
  const p = await project('status-identical', {
    'reeval.config.ts': fakeConfig({ harness: '{ turnMs: 1000 }' }),
    'evals/s.eval.ts': IDENTICAL,
  })
  const run = await runCli(p.dir, ['run', '--ui', 'plain'])
  assert.equal(run.code, 0, run.stdout + run.stderr)
  assert.match(
    listOf(run.stdout),
    /passed every trial \(4 of 4 and 4 of 4\): the task can't tell them apart, since both always pass\. Fix at evals\/s\.eval\.ts: make the task harder, so the baseline can fail\./,
  )
  const trials = readRun(p.dir).run.evals.flatMap((e) => e.trials)
  assert.deepEqual(
    new Set(trials.map((a) => a.timings.agentMs)),
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
    readFileSync(config, 'utf8').replace('fakeAgent({', 'fakeAgent({ turnMs: 1000,'),
  )
  // The hidden-test grader runs on the fake sandbox, so the run needs no Docker.
  const file = join(dir, 'with-compare-questions.eval.ts')
  const source = readFileSync(file, 'utf8')
  assert.match(source, /env: docker\(\),/)
  writeFileSync(
    file,
    source
      .replace(
        "import { docker } from 'reeval/sandbox'",
        "import { fakeSandbox } from 'reeval/sandbox'",
      )
      .replace('env: docker(),', "env: fakeSandbox(), egress: 'allow-all',"),
  )
  const run = await runCli(dir, ['run', '--ui', 'plain', '-v'], { timeoutMs: 300_000 })
  assert.equal(run.code, 0, run.stdout + run.stderr)
  assert.match(
    run.stdout,
    /but the variant looks different: (.+ and )?"Which divide\(\) says more clearly what went wrong when b is…" picked the variant in 8 of 8 votes \(4 of 4 decisive pairs\); about \d+ trials a side would confirm it\./,
  )
  assert.match(run.stdout, / won 8 of 8$/m, 'the standings count the same votes')
  assert.doesNotMatch(run.stdout, /make the task harder/)
  const brief = await runCli(dir, ['run', '--ui', 'plain'], { timeoutMs: 300_000 })
  assert.match(
    brief.stdout,
    /^ {5}Worth knowing: Both passed every trial, but the variant looks different; set trials: \d+ at with-compare-questions\.eval\.ts to confirm it\.$/m,
    'without -v, the remark is one short line',
  )
})

test('with-effort at trials: 3, too few for a rank test, still names its speedup', async () => {
  const dir = await copyOut('with-effort')
  const file = join(dir, 'with-effort.eval.ts')
  writeFileSync(file, readFileSync(file, 'utf8').replace('trials: 4', 'trials: 3'))
  const run = await runCli(dir, ['run', '--ui', 'plain'], { timeoutMs: 300_000 })
  assert.equal(run.code, 0, run.stdout + run.stderr)
  assert.match(
    run.stdout,
    /^ {5}Worth knowing: 3 trials per side; set trials: \d+ at with-effort\.eval\.ts(?::\d+)? to rule out a difference\. So far, \S+ (.+ and )?runs [\d.]+× faster\.$/m,
  )
  const verbose = await runCli(dir, ['run', '--ui', 'plain', '-v'], { timeoutMs: 300_000 })
  assert.match(verbose.stdout, /^ {5}\S+ +3 of 3 {2}same {2}(.+ · )?[\d.]+× faster \(leans\)/m)
  assert.doesNotMatch(verbose.stdout, /\blooks [\d.]+×/, 'a lean is marked after it, not before')
})

test("a compare on two harnesses reads each harness's environments, so a disagreement shows, with or without variants", async () => {
  const p = await project('status-baseline-disagrees', {
    'reeval.config.ts': `import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'
export default defineConfig({
  include: ['evals/*.eval.ts'],
  agents: [fakeAgent({ id: 'left' }), fakeAgent({ id: 'right' })],
  sandbox: fakeSandbox(),
})
`,
    'evals/c.eval.ts': `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
const plain = defineEnvironment('plain', {})
const marked = defineEnvironment('marked', { files: { 'marker.txt': 'ok\\n' } })
export default defineEval({
  trials: 1, compare: { baseline: plain, variants: [marked] },
  async task(c) {
    await c.send('go')
    assert.equal(c.trial.cell.key.startsWith('left/'), true, 'on left')
  },
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
    /^left\n {2}environment +pass\n {2}plain +1 of 1\n {2}marked +1 of 1 {2}same\nright\n {2}environment +pass\n {2}plain +0 of 1\n {4}error {2}on left false !== true\n {2}marked +0 of 1 {2}same$/m,
  )
  const alone = { ...e, cells: e.cells.filter((c) => c.variant === null) }
  assert.match(
    text(evalRow(run, alone, [])),
    /^left\n {2}environment +pass\n {2}plain +1 of 1\nright\n {2}environment +pass\n {2}plain +0 of 1$/m,
  )
})

test('under -v a judged check reads as its judge score, marked (leans), not again as its pass rate', async () => {
  const p = await project('status-judged-lean', {
    'reeval.config.ts': fakeConfig(),
    'evals/c.eval.ts': `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
const plain = defineEnvironment('plain', {})
const marked = defineEnvironment('marked', { files: { 'marker.txt': 'ok\\n' } })
export default defineEval({
  trials: 1, compare: { baseline: plain, variants: [marked] },
  async task(c) {
    await c.send('go')
    assert.equal(c.trial.cell.role === 'variant', true, 'tidy')
  },
})
`,
  })
  await runCli(p.dir, ['run', '--ui', 'plain'])
  const { run } = readRun(p.dir)
  const [e] = suiteResult(run).files.flatMap((f) => f.evals)
  assert.ok(e?.cells)
  const lean = {
    variant: 1,
    baseline: 0,
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

const AT = (target: string) => `import { capability, defineEval, regression } from 'reeval'
import { near } from './graders.ts'
export default defineEval({
  cases: [{ key: 'a' }, { key: 'b' }],
  trials: 2,
  target: ${target},
  graders: [near],
  task: async (c) => void (await c.send('go')),
})
`

const NEAR_LIST = `evals/capability.eval.ts
└─ ✗ capability  mean 79% · 0/2 cases hit ≥ 80% (pass@2)  capability(0.8, { blocking: true })
     #a  79%  near 79%
     #b  79%  near 79%

evals/floor.eval.ts
└─ ✗ floor  mean 0% · 0/1 trial ≥ 0%  regression(0.001)
     #1  0%  zero 0%

evals/regression.eval.ts
└─ ✗ regression  mean 79% · 0/4 trials ≥ 80%, worst 79%  regression(0.8)
     #a  79%  near 79%
     #b  79%  near 79%

Done in <time> · 3 evals · 3 below`

test('a score just under its target never reads as reaching it, on a row, a grader or the worst run, nor below 0%', async () => {
  assert.equal(scorePercent(0.799, 0.8), '79%')
  assert.equal(scorePercent(0.799), '80%', 'canary: without the threshold it rounds up')
  assert.equal(scorePercent(0, 0.001), '0%')
  const p = await project('status-near-target', {
    'reeval.config.ts': fakeConfig(),
    'evals/graders.ts': `import { defineGrader } from 'reeval'
export const near = defineGrader('near', { grade: () => 1, score: () => 0.799 })
export const zero = defineGrader('zero', { grade: () => 1, score: () => 0 })
`,
    'evals/regression.eval.ts': AT('regression(0.8)'),
    'evals/capability.eval.ts': AT('capability(0.8, { blocking: true })'),
    'evals/floor.eval.ts': `import { defineEval, regression } from 'reeval'
import { zero } from './graders.ts'
export default defineEval({
  target: regression(0.001),
  graders: [zero],
  task: async (c) => void (await c.send('go')),
})
`,
  })
  const run = await runCli(p.dir, ['run', '--ui', 'plain'])
  assert.equal(run.code, 1, run.stdout + run.stderr)
  assert.equal(listOf(run.stdout), NEAR_LIST)
  const show = await runCli(p.dir, ['show'])
  assert.doesNotMatch(show.stdout, /^ {4}#.*\b80%|-1%/m, show.stdout)
  assert.equal(show.stdout.match(/^ {4}#[ab] {2}79% {2}near 79%$/gm)?.length, 4, show.stdout)
  assert.match(
    show.stdout,
    /^✗ regression +mean 79% · 0\/4 trials ≥ 80%, worst 79% +regression\(0\.8\)$/m,
  )
  // With no earlier run every eval is new, counted against its target as the run counts it.
  const compare = await runCli(p.dir, ['compare'])
  assert.match(compare.stdout, /^3 new evals \(3 below\)$/m, compare.stdout)
})

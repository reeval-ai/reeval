import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { fakeAgent } from '../src/agent.ts'
import { resolveConfig } from '../src/config.ts'
import { collect, collectingFile, registerTest } from '../src/engine/collector.ts'
import { useEngine } from '../src/engine/runtime.ts'
import { defineEnvironment } from '../src/environment.ts'
import { declareDefault, defineEval } from '../src/evaluate.ts'
import { fakeJudge } from '../src/judge.ts'
import { fakeSandbox } from '../src/sandbox.ts'
import type { EnvironmentHelpers, RunContext } from '../src/types.ts'
import { fakeConfig, project, readRun, recordedRuns, runCli, tempDir } from './helpers.ts'
import { fixture } from './support/fixture.ts'

const config = (extra: string, harness = 'fakeAgent({})') => `
import { defineConfig, defineEnvironment, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'
import { fakeJudge } from 'reeval/judge'
const sandbox = fakeSandbox({ dir: new URL('./sandboxes', import.meta.url) })
export default defineConfig({
  target: regression(),
  agents: ${harness},
  environments: defineEnvironment('fake', { sandbox }),
  judge: { model: fakeJudge({ score: 0.9 }) },
  ${extra}
})
`

const SKILL = `---
name: house-greeting
description: The organization's greeting style. Use when writing greetings.
---

Greet people with "Ahoy, <name>!".
`

const REVIEWER_DESCRIPTION = `Reviews an agent skill before it ships: frontmatter, triggering and
progressive disclosure.
Use when: someone asks for a skill review.`

/** A fake agent that writes ok.txt only when it's given a skill. */
const SKILLED = `fakeAgent({ withSkill: { files: { 'ok.txt': 'yes' } } })`

describe('harness matrix, cascade and runs', () => {
  test('harness lists and runs expand into attempts with per-cell pass rates', async () => {
    const p = await project('matrix', {
      'reeval.config.ts': config(
        '',
        `[fakeAgent({ id: 'good', files: { 'ok.txt': 'yes' } }), fakeAgent({ id: 'bad' })]`,
      ),
      'evals/writes-ok.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
export default defineEval({
  runs: 2,
  graders: [hasFile('ok.txt')],
  async task(c) {
    await c.send('go')
    assert.ok(c.attempt.n > 0)
  },
})
`,
    })
    const r = await runCli(p.dir, ['run', '--output-logs', 'full'])
    assert.equal(r.code, 1, r.stdout + r.stderr)
    assert.match(r.stdout, /^ {2}➜ {2}Scope: +1 eval file · 1 eval · 2 cells · 4 attempts$/m)
    assert.match(r.stdout, /^\[writes#1 good\] ▶ writes-ok$/m)
    assert.match(r.stdout, /^\[writes#2 bad\] ▶ writes-ok$/m)
    assert.match(
      r.stdout,
      /evals\/writes-ok\.eval\.ts\n└─ ✗ writes-ok {2}2\/4 runs at 100%, worst 0% {2}regression\(1\)\n {5}#1–2 · bad {2}0% {2}has-file:ok\.txt 0%\n/,
    )
    assert.match(r.stdout, /^Done in \S+ · 1 eval · 1 below$/m)
    const thirds = await project('matrix-thirds', {
      'reeval.config.ts': config('', `fakeAgent({ id: 'one' })`),
      'evals/two-of-three.eval.ts': `import { defineEval, metric } from 'reeval'
export default defineEval({
  runs: 3,
  target: metric(0.5),
  async task(c) {
    await c.send('go')
    if (c.attempt.n === 2) throw new Error('the second attempt fails')
  },
})
`,
    })
    const rounded = await runCli(thirds.dir)
    assert.equal(rounded.code, 0, rounded.stdout + rounded.stderr)
    assert.match(
      rounded.stdout,
      /✓ two-of-three {2}67% ≥ 50% {2}metric\(0\.5\)$/m,
      'a mean rounds down, never up to its threshold',
    )
    const { run, evals } = readRun(p.dir)
    assert.equal(run.summary.attempts, 4)
    assert.deepEqual(
      run.stack.harnesses.map((h) => h.id),
      ['bad', 'good'],
    )
    assert.deepEqual(run.plan, {
      evals: 1,
      cells: 2,
      attempts: 4,
      estimateMs: run.plan.estimateMs,
      sandboxWarnings: [],
    })
    const [e] = evals
    assert.equal(e?.outcome, 'fail')
    assert.equal(e?.passRate, 0.5)
    assert.deepEqual(
      e?.cells.map((c) => [c.key, c.role, c.gate, c.runs, c.pass, c.passRate, c.outcome]),
      [
        ['good/fake/fake', 'control', 'all', 2, 2, 1, 'pass'],
        ['bad/fake/fake', 'control', 'all', 2, 0, 0, 'fail'],
      ],
    )
    assert.deepEqual(
      e?.attempts.map((a) => a.id),
      ['good/fake/fake#1', 'good/fake/fake#2', 'bad/fake/fake#1', 'bad/fake/fake#2'],
    )

    const narrowed = await runCli(p.dir, ['run', '--cell', 'good/fake/fake', '--runs', '1'])
    assert.equal(narrowed.code, 0, narrowed.stdout)
    assert.deepEqual(
      readRun(p.dir).evals[0]?.attempts.map((a) => a.id),
      ['good/fake/fake#1'],
      'a filter matches cell keys, and --runs overrides the eval runs',
    )
  })

  test('config defaults cascade and agents can be edited on each eval', async () => {
    const p = await project('cascade', {
      'reeval.config.ts': config('', `[fakeAgent({ id: 'a' }), fakeAgent({ id: 'b' })]`),
      'evals/replaced.eval.ts': `import { defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'
export default defineEval({
  agents: fakeAgent({ id: 'c' }),
  async task(c) { await c.send('x') },
})
`,
      'evals/added.eval.ts': `import { defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'
export default defineEval({
  agents: { add: [fakeAgent({ id: 'd' })] },
  async task(c) { await c.send('x') },
})
`,
      'evals/inherits.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ async task(c) { await c.send('x') } })
`,
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const cells = Object.fromEntries(
      readRun(p.dir).evals.map((e) => [e.name, e.cells.map((c) => c.harness)]),
    )
    assert.deepEqual(cells, { replaced: ['c'], added: ['a', 'b', 'd'], inherits: ['a', 'b'] })
  })

  test('harness edits as data: { add } appends to the inherited list, { only } keeps by id', async () => {
    const p = await project('harness-edits', {
      'reeval.config.ts': config('', `[fakeAgent({ id: 'a' }), fakeAgent({ id: 'b' })]`),
      'evals/kept.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ agents: { only: 'a' }, async task(c) { await c.send('x') } })
`,
      'evals/added.eval.ts': `import { defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'
export default defineEval({
  agents: { add: [fakeAgent({ id: 'd' })] },
  async task(c) { await c.send('x') },
})
`,
      'evals/kept-both.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ agents: { only: ['b', 'a'] }, async task(c) { await c.send('x') } })
`,
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const cells = Object.fromEntries(
      readRun(p.dir).evals.map((e) => [e.name, e.cells.map((c) => c.harness)]),
    )
    assert.deepEqual(cells, { kept: ['a'], added: ['a', 'b', 'd'], 'kept-both': ['a', 'b'] })
  })

  test('tags filter, skip, for, and a filter that matches nothing exits 2', async () => {
    const p = await project('tags', {
      'reeval.config.ts': fakeConfig(),
      'evals/big.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ tags: ['slow'], async task() {} })
`,
      'evals/bigger.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ tags: ['slow', 'flaky'], async task() {} })
`,
      'evals/quick.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ async task() {} })
`,
      'evals/later.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ skip: true, async task() {} })
`,
      'evals/adds.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  cases: [{ key: '1+2', a: 1, b: 2 }, { key: '3+4', a: 3, b: 4 }],
  async task(c, { a, b }) {
    if (a + b !== (a === 1 ? 3 : 7)) throw new Error('bad sum')
  },
})
`,
    })
    const slow = await runCli(p.dir, ['run', '--tag', 'slow', '--tag', '!flaky'])
    assert.equal(slow.code, 0, slow.stdout + slow.stderr)
    assert.deepEqual(
      readRun(p.dir).evals.map((e) => [e.name, e.tags]),
      [['big', ['slow']]],
    )
    const all = await runCli(p.dir)
    assert.equal(all.code, 0, all.stdout)
    const names = readRun(p.dir).evals.map((e) => [e.name, e.outcome])
    assert.deepEqual(names, [
      ['adds', 'pass'],
      ['big', 'pass'],
      ['bigger', 'pass'],
      ['later', 'skipped'],
      ['quick', 'pass'],
    ])
    const adds = readRun(p.dir).evals.find((e) => e.name === 'adds')
    assert.deepEqual(
      adds?.cases?.map((k) => k.key),
      ['1+2', '3+4'],
    )
    const none = await runCli(p.dir, ['run', 'no-such-eval'])
    assert.equal(none.code, 2)
    assert.match(none.stderr, /No evals matched .* with filter "no-such-eval"/)
  })
})

describe('compare', () => {
  const envs = `import { defineEnvironment } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
const sandbox = fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })
export const base = defineEnvironment('base', { sandbox, env: { MODE: 'base' } })
export const skilled = base.extendEnvironment('skilled', ({ skill }) => ({
  env: { MODE: 'skilled' },
  skills: [skill.local('../skills')],
}))
`

  const each = (
    runs = 1,
    cases = "['ada', 'grace', 'linus', 'margaret', 'dennis', 'barbara'].map((key) => ({ key }))",
  ) => ({
    'reeval.config.ts': config('', SKILLED),
    'skills/house-greeting/SKILL.md': SKILL,
    'evals/envs.ts': envs,
    'evals/writes-ok.eval.ts': `import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { base, skilled } from './envs.ts'
export default defineEval({
  cases: ${cases},
  compare: { control: base, variants: [skilled], minLift: MIN_LIFT },
  runs: ${runs},
  graders: [hasFile('ok.txt')],
  async task(c, { key: name }) {
    await c.send('write ok.txt for ' + name)
  },
})
`,
  })

  test('cases pool into one paired lift that minLift gates', async () => {
    const files = each()
    const p = await project('each-pooled', {
      ...files,
      'evals/writes-ok.eval.ts': files['evals/writes-ok.eval.ts'].replace('MIN_LIFT', '0.2'),
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    // The family is one row, its arms pooled over the cases.
    const pooled =
      /✓ writes-ok {2}6\/6 runs at 100% {2}regression\(1\)\n[│ ]+arm +pass\n[│ ]+base +0 of 6\n[│ ]+skilled +6 of 6 {2}helped\n/
    assert.match(r.stdout, pooled)
    assert.doesNotMatch(r.stdout, /Failed cases/, 'every case passed')
    assert.match(
      r.stdout,
      /^Done in \S+ · 1 eval · 1 on target$/m,
      'the eval with cases counts once',
    )

    const { evals, read } = readRun(p.dir)
    const [ev] = evals
    assert.equal(evals.length, 1, 'one eval, its cases inside it')
    assert.equal(ev?.id, 'writes-ok')
    assert.deepEqual(
      ev?.cases?.map((k) => [k.key, k.index]),
      ['ada', 'grace', 'linus', 'margaret', 'dennis', 'barbara'].map((n, i) => [n, i]),
    )
    assert.ok(
      ev?.cases?.every((k) => k.cells.every((c) => c.lift?.minLift === undefined)),
      'a case is not gated on minLift alone',
    )
    assert.deepEqual(
      ev?.cells.map((c) => [c.key, c.rate?.pass, c.rate?.counted, c.rate?.interval.method]),
      [
        ['fake/base/fake', 0, 6, 'wilson'],
        ['fake/skilled/fake', 6, 6, 'wilson'],
      ],
    )
    const lift = ev?.lifts?.[0]
    assert.deepEqual(
      [
        lift?.vs,
        lift?.pairs,
        lift?.discordant,
        lift?.interval.method,
        lift?.verdict,
        lift?.outcome,
      ],
      ['fake/base/fake', 6, { variantOnly: 6, controlOnly: 0 }, 'newcombe-paired', 'lift', 'pass'],
    )
    assert.equal(ev?.outcome, 'pass')
    const summary = read('summary.md')
    assert.match(summary, /^## Baseline vs\. variants$/m)
    assert.match(summary, /^\| Arm \| Pass rate \| Lift \| Pass-rate verdict \|/m)
    assert.match(summary, /^\| base \| 0% \| n\/a \| Baseline \|/m)
    assert.match(summary, /^\| skilled \| 100% \| \+100 pts \| Helped \|/m)

    const agent = await runCli(p.dir, ['run', '--ui', 'agent'])
    assert.equal(agent.code, 0, agent.stdout + agent.stderr)
    assert.match(agent.stdout, pooled)

    const q = await runCli(p.dir, [
      'query',
      'select eval_key, variant, pairs, variant_pass_at_1, control_pass_at_1, verdict, outcome from case_lift',
      '--json',
    ])
    assert.equal(q.code, 0, q.stdout + q.stderr)
    assert.deepEqual(JSON.parse(q.stdout)[0], {
      eval_key: 'writes-ok',
      variant: 'skilled',
      pairs: 6,
      variant_pass_at_1: 1,
      control_pass_at_1: 0,
      verdict: 'lift',
      outcome: 'pass',
    })
    const paired = await runCli(p.dir, [
      'query',
      "select distinct pass_verdict, small_sample from factor_effects where tier = 'paired'",
      '--json',
    ])
    assert.deepEqual(
      JSON.parse(paired.stdout),
      [{ pass_verdict: 'effect', small_sample: 0 }],
      'six cases whose interval excludes 0 are no small sample',
    )
    const rates = await runCli(p.dir, [
      'query',
      'select cell_key, sum(pass) as pass, sum(counted) as counted, avg(pass_at_1) as pass_at_1 from case_rates where run_id = (select max(run_id) from runs) group by cell_key order by cell_key',
      '--json',
    ])
    assert.equal(rates.code, 0, rates.stdout + rates.stderr)
    assert.deepEqual(JSON.parse(rates.stdout), [
      { cell_key: 'fake/base/fake', pass: 0, counted: 6, pass_at_1: 0 },
      { cell_key: 'fake/skilled/fake', pass: 6, counted: 6, pass_at_1: 1 },
    ])
  })

  test('a pooled lift below minLift fails the run, and the eval with cases', async () => {
    const files = each()
    const p = await project('each-min-lift', {
      ...files,
      'evals/writes-ok.eval.ts': files['evals/writes-ok.eval.ts'].replace('MIN_LIFT', '0.6'),
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 1, r.stdout + r.stderr)
    assert.match(
      r.stdout,
      /✗ writes-ok {2}6\/6 runs at 100% {2}regression\(1\)\n[│ ]+arm +pass\n[│ ]+base +0 of 6\n[│ ]+skilled +6 of 6 {2}helped, not by minLift 60\n/,
    )
    assert.doesNotMatch(r.stdout, /Failed cases/, 'every case passed on its own')
    assert.match(
      r.stdout,
      /^Done in \S+ · 1 eval · 1 below$/m,
      'the pooled gate fails the eval, counted once',
    )
    const [ev] = readRun(p.dir).evals
    assert.equal(ev?.outcome, 'fail')
    assert.ok(
      ev?.cases?.every((k) => k.outcome === 'pass'),
      'every case passed on its own',
    )
  })

  test('cases over several runs a case pair per-case pass rates', async () => {
    const files = each(2, "['ada', 'grace', 'linus'].map((key) => ({ key }))")
    const p = await project('each-runs', {
      ...files,
      'evals/writes-ok.eval.ts': files['evals/writes-ok.eval.ts'].replace('MIN_LIFT', '0.2'),
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const lift = readRun(p.dir).evals[0]?.lifts?.[0]
    assert.deepEqual(
      [lift?.pairs, lift?.points, lift?.interval.method, lift?.verdict, lift?.outcome],
      [3, 1, 't-cases', 'insufficient', 'pass'],
    )
    const paired = await runCli(p.dir, [
      'query',
      "select distinct small_sample from factor_effects where tier = 'paired'",
      '--json',
    ])
    assert.deepEqual(JSON.parse(paired.stdout), [{ small_sample: 1 }], 'three cases are too few')
    // Three pairs are too few for the lift to hold, however one-sided they are: it shows the direction.
    assert.match(r.stdout, /^[│ ]+skilled +6 of 6 {2}helped$/m)
  })

  test('variants run next to the control, lift is stored, and the control is not gated', async () => {
    const p = await project('compare', {
      'reeval.config.ts': config('', SKILLED),
      'skills/house-greeting/SKILL.md': SKILL,
      'evals/envs.ts': envs,
      'evals/writes-ok.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { base, skilled } from './envs.ts'
export default defineEval({
  compare: { control: base, variants: [skilled] },
  runs: 2,
  graders: [hasFile('ok.txt')],
  async task(c) {
    await c.send('go')
    const mode = (await c.exec('printf %s "$MODE"')).stdout
    assert.equal(mode, c.attempt.cell.role === 'control' ? 'base' : 'skilled')
  },
})
`,
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /^ {2}➜ {2}Scope: +1 eval file · 1 eval · 2 cells · 4 attempts$/m)
    // A successful compare reads as one: the control's expected misses aren't failures.
    const block =
      /✓ writes-ok {2}2\/2 runs at 100% {2}regression\(1\)\n[│ ]+arm +pass\n[│ ]+base +0 of 2\n[│ ]+error {2}score 0\.00 below 1: has-file:ok\.txt scored 0\.00 \(2 runs\)\n[│ ]+skilled +2 of 2 {2}helped\n/
    assert.match(r.stdout, block)
    assert.match(r.stdout, /^Done in \S+ · 1 eval · 1 on target$/m)

    const color = await runCli(p.dir, ['run'], { env: { FORCE_COLOR: '1' } })
    assert.equal(color.code, 0, color.stdout + color.stderr)
    assert.ok(!color.stdout.includes('\x1b[31m'), 'nothing red')

    const agent = await runCli(p.dir, ['run', '--ui', 'agent'])
    assert.equal(agent.code, 0, agent.stdout + agent.stderr)
    assert.match(agent.stdout, block)

    const gha = await runCli(p.dir, ['run', '--log-order', 'grouped', '--output-logs', 'full'], {
      env: { GITHUB_ACTIONS: 'true' },
    })
    assert.equal(gha.code, 0, gha.stdout + gha.stderr)
    assert.doesNotMatch(gha.stdout, /^::error/m)
    assert.equal(gha.stdout.match(/^::group::/gm)?.length, 4, 'expected misses collapse too')

    const md = readRun(p.dir).read('summary.md')
    assert.match(md, /^## Baseline vs\. variants$/m)
    assert.match(md, /^\| Arm \| Pass rate \| Lift \| Pass-rate verdict \|/m)
    assert.match(md, /^\| base \| 0% \| n\/a \| Baseline \|/m)
    assert.match(md, /^\| skilled \| 100% \| \+100 pts \| Too few runs \|/m)
    assert.match(md, /^## Failures and caveats$/m)
    assert.match(
      md,
      /^\| error \| score 0\.00 below 1: has-file:ok\.txt scored 0\.00 \| n\/a \| 2 of 4 \|/m,
    )
    const { run, evals } = readRun(p.dir)
    const [e] = evals
    assert.equal(e?.outcome, 'pass', 'the ungated control fails without failing the eval')
    assert.equal(e?.compare?.baseline, 'base')
    assert.equal(run.summary.notGated, 2)
    const [control, variant] = e?.cells ?? []
    assert.deepEqual(
      [control?.role, control?.gate, variant?.role, variant?.variant, variant?.gate],
      ['control', 'none', 'variant', 'skilled', 'all'],
    )
    // 2/2 against 0/2: Newcombe's interval from the Wilson bounds [0.342, 1] and [0, 0.658].
    assert.deepEqual(variant?.lift, {
      vs: 'fake/base/fake',
      control: { pass: 0, counted: 2 },
      variant: { pass: 2, counted: 2 },
      points: 1,
      interval: { lo: 0.07, hi: 1, level: 0.95, method: 'newcombe-wilson' },
      withinNoise: false,
    })
    assert.deepEqual(variant?.overrides, ['env.MODE'])
    const envRecords = Object.fromEntries(run.environments.map((x) => [x.name, x]))
    assert.equal(envRecords.skilled?.parent, 'base')
    assert.deepEqual(envRecords.skilled?.overrides, ['env.MODE'])
    assert.deepEqual(
      envRecords.skilled?.skills.map((s) => [s.name, s.source, s.placement]),
      [['house-greeting', 'local:skills', 'harness']],
    )
  })

  test('a target gates the variants only, and minLift fails a variant cell below it', async () => {
    const p = await project('compare-gates', {
      'reeval.config.ts': config('', SKILLED),
      'skills/house-greeting/SKILL.md': SKILL,
      'evals/envs.ts': envs,
      'evals/all-gated.eval.ts': `import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { base, skilled } from './envs.ts'
export default defineEval({
  runs: 1, compare: { control: base, variants: [skilled] },
  graders: [hasFile('ok.txt')],
  async task(c) {

  await c.send('go')

  },
})
`,
      'evals/no-worse.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { base, skilled } from './envs.ts'
export default defineEval({
  runs: 2,
  compare: { control: base, variants: [skilled], minLift: 0.5 },
  async task(c) {
    await c.send('go')
    if (c.attempt.cell.role === 'control') await c.exec('touch ok.txt')
    if (c.attempt.cell.role === 'variant') throw new Error('variant fails')
    assert.notEqual(await c.readFile('ok.txt'), null)
  },
})
`,
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 1, r.stdout + r.stderr)
    const [all, noWorse] = readRun(p.dir).evals
    assert.equal(all?.outcome, 'pass', 'the control reports only, under any target')
    assert.equal(all?.cells[0]?.gate, 'none')
    assert.equal(noWorse?.cells[1]?.outcome, 'fail')
    assert.equal(noWorse?.outcome, 'fail', 'minLift fails the variant cell')
    assert.match(r.stdout, /✗ no-worse.*not by minLift/s)
    assert.match(r.stdout, /^Done in \S+ · 2 evals · 1 on target · 1 below$/m)
  })

  test('compare.harness scopes variants; other harnesses run the control only', async () => {
    const p = await project('compare-scope', {
      'reeval.config.ts': config('', `[fakeAgent({ id: 'a' }), fakeAgent({ id: 'b' })]`),
      'skills/house-greeting/SKILL.md': SKILL,
      'evals/envs.ts': envs,
      'evals/scoped.eval.ts': `import { defineEval } from 'reeval'
import { base, skilled } from './envs.ts'
export default defineEval({
  compare: { control: base, variants: [skilled], agents: ['b'] },
  async task(c) {
 await c.send('x') 
  },
})
`,
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.deepEqual(
      readRun(p.dir).evals[0]?.cells.map((c) => c.key),
      ['a/base/fake', 'b/base/fake', 'b/skilled/fake'],
    )
  })
})

// Which evals, cells and attempts a profile plans is pinned by the plan snapshots in
// plan.test.ts (test/plan/profiles); these check what a run does with that plan.
describe('targets', () => {
  const flakyTask = `async task(c) {
    if (c.attempt.n === 3) throw new Error('the third attempt fails')
  }`
  const flakyFile = (
    target: string,
  ) => `import { capability, defineEval, metric, regression } from 'reeval'
export default defineEval({
  runs: 5${target},
  ${flakyTask},
})
`

  test('each target gates the mean score, pass^k or pass@k', async () => {
    const p = await project('targets', {
      'reeval.config.ts': fakeConfig(),
      'evals/default.eval.ts': flakyFile(''),
      'evals/at-08.eval.ts': flakyFile(', target: metric(0.8)'),
      'evals/at-09.eval.ts': flakyFile(', target: metric(0.9)'),
      'evals/reports.eval.ts': flakyFile(', target: metric()'),
      'evals/any-one.eval.ts': flakyFile(', target: capability(1, { blocking: true })'),
      'evals/every-one.eval.ts': flakyFile(', target: regression()'),
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 1, r.stdout + r.stderr)
    const { evals } = readRun(p.dir)
    const cells = evals.map((e) => [
      e.name,
      e.target,
      e.cells[0]?.gate,
      e.cells[0]?.scores,
      e.cells[0]?.outcome,
      e.outcome,
    ])
    const order = (a: string, b: string) => a.localeCompare(b)
    const scores = { meanScore: 0.8, passAtK: 1, passHatK: 0 }
    assert.deepEqual(
      cells.sort((a, b) => order(String(a[0]), String(b[0]))),
      [
        [
          'any-one',
          { kind: 'capability', threshold: 1, blocking: true },
          'any',
          scores,
          'pass',
          'pass',
        ],
        ['at-08', { kind: 'metric', threshold: 0.8 }, { passRate: 0.8 }, scores, 'pass', 'pass'],
        ['at-09', { kind: 'metric', threshold: 0.9 }, { passRate: 0.9 }, scores, 'fail', 'fail'],
        ['default', { kind: 'regression', threshold: 1 }, 'all', scores, 'fail', 'fail'],
        ['every-one', { kind: 'regression', threshold: 1 }, 'all', scores, 'fail', 'fail'],
        ['reports', { kind: 'metric' }, 'none', scores, 'fail', 'pass'],
      ],
    )
    assert.deepEqual(evals[0]?.scores, scores, "the eval's scores are its target cells'")
    assert.match(r.stdout, /✓ at-08 +80% ≥ 80% +metric\(0\.8\)$/m)
    assert.match(r.stdout, /✗ at-09 +80% < 90% +metric\(0\.9\)$/m)
    assert.match(
      r.stdout,
      /✓ any-one +4\/5 runs at 100% \(pass@5\) +capability\(1, \{ blocking: true \}\)$/m,
    )
    assert.match(r.stdout, /· reports +80% +metric\(\)$/m)
    assert.match(r.stdout, /^Done in \S+ · 6 evals · 2 on target · 3 below · 1 report only$/m)
  })

  test('a config-level target applies to every eval', async () => {
    const p = await project('config-target', {
      'reeval.config.ts': fakeConfig({ extra: 'target: metric(0.8),' }),
      'evals/steady.eval.ts': flakyFile(''),
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.deepEqual(readRun(p.dir).evals[0]?.cells[0]?.gate, { passRate: 0.8 })
  })

  test("a capability target that doesn't block reads fail without failing the run", async () => {
    const p = await project('capability-target', {
      'reeval.config.ts': fakeConfig({ extra: 'target: capability(),' }),
      'evals/never.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  runs: 2,
  async task() {
    throw new Error('never lands')
  },
})
`,
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.equal(readRun(p.dir).evals[0]?.outcome, 'fail')
    assert.match(r.stdout, /^└─ · never {2}0\/2 runs at 100% \(pass@2\) {2}capability\(1\)$/m)
    // Canary: the same target set to block fails the run.
    writeFileSync(
      join(p.dir, 'reeval.config.ts'),
      fakeConfig({ extra: 'target: capability(1, { blocking: true }),' }),
    )
    assert.equal((await runCli(p.dir)).code, 1)
  })

  test("in CI, the plan names the evals whose target can't fail it", async () => {
    const p = await project('ci-target', {
      'reeval.config.ts': fakeConfig({ extra: 'target: metric(),' }),
      'evals/reports.eval.ts': flakyFile(''),
      'evals/blocks.eval.ts': flakyFile(', target: regression(0.8)'),
    })
    const hint =
      /Hint: +1 eval can't fail CI \([^)]+\): its target only reports; set target: regression\(\) \(or metric\(0\.8\), capability\(1, \{ blocking: true \}\)\) in the eval or the config to fail on a miss$/m
    const ci = await runCli(p.dir, ['run', '--dry-run'], { env: { CI: 'true' } })
    assert.equal(ci.code, 0, ci.stdout + ci.stderr)
    assert.match(ci.stdout, hint)
    assert.match(ci.stdout, /regression\(0\.8\)/, '--dry-run shows each target')
    const local = await runCli(p.dir, ['run', '--dry-run'])
    assert.doesNotMatch(local.stdout, /can't fail CI/, 'no hint outside CI')
  })
})

describe('profiles', () => {
  test('a plan over budget.attempts exits 2 unless --force; the text --dry-run shows it', async () => {
    const p = await fixture('plan/profiles')
    const r = await runCli(p.dir, ['run', '--dry-run'], { env: { CI: 'true' } })
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.match(
      r.stdout,
      /^ {2}➜ {2}Profile: +pr \(auto: CI is set\)\n(.*\n)* {2}➜ {2}Scope: +3 eval files · 3 evals \(1 skipped\) · 4 cells · 6 attempts \(budget: 5 ✗\)$/m,
    )
    assert.match(r.stdout, /^eval +agents +variants +runs +attempts +target +notes$/m)
    assert.equal(existsSync(join(p.dir, '.reeval/runs')), false, 'a dry run writes no run')

    const over = await runCli(p.dir, ['run'], { env: { CI: 'true' } })
    assert.equal(over.code, 2, over.stdout + over.stderr)
    assert.match(
      over.stderr,
      /this run plans 6 attempts, over budget\.attempts 5 \(profile pr\)\. Narrow it with --tag or --runs, or raise the budget\. \(--force runs it anyway\)/,
    )
    const forced = await runCli(p.dir, ['run', '--force'], { env: { CI: 'true' } })
    assert.equal(forced.code, 0, forced.stdout + forced.stderr)
    const { run, evals: ran } = readRun(p.dir)
    assert.deepEqual(
      [run.profile?.name, run.profile?.reason, run.profile?.limit.runs],
      ['pr', 'auto: CI is set', 1],
    )
    const byName = (a: string, b: string) => a.localeCompare(b)
    assert.deepEqual(
      ran
        .map((e) => [e.name, e.attempts.length, e.outcome])
        .sort((a, b) => byName(String(a[0]), String(b[0]))),
      [
        ['compared', 1, 'pass'],
        ['own-agent', 1, 'skipped'],
        ['plain', 1, 'pass'],
        ['regression', 4, 'pass'],
      ],
    )
  })

  test("a profile's judge needs its own key, and a malformed one exits 2", async () => {
    const p = await project('profile-judge-key', {
      'reeval.config.ts': fakeConfig({
        extra: `profiles: { real: { judge: { model: 'google/gemini-3.8-flash' } } },`,
      }),
      'evals/judged.eval.ts': `import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
export default defineEval({
  graders: [judge('Did it?', { inputs: { diff: true } })],
  async task(c) {
    await c.send('x')
  },
})
`,
    })
    const noKeys = {
      GOOGLE_GENERATIVE_AI_API_KEY: '',
      AI_GATEWAY_API_KEY: '',
      VERCEL_OIDC_TOKEN: '',
    }
    const canary = await runCli(p.dir, ['run'], { env: noKeys })
    assert.equal(canary.code, 0, "the config's fake judge needs no key")
    const missing = await runCli(p.dir, ['run', '--profile', 'real'], { env: noKeys })
    assert.equal(missing.code, 2, missing.stdout + missing.stderr)
    assert.match(
      missing.stderr,
      /Missing credentials: GOOGLE_GENERATIVE_AI_API_KEY \(for direct\(\)\) for the judge model, "google\/gemini-3\.8-flash"\./,
    )
    const malformed = await runCli(p.dir, ['run', '--profile', 'real'], {
      env: { ...noKeys, GOOGLE_GENERATIVE_AI_API_KEY: 'AIza\nrest' },
    })
    assert.equal(malformed.code, 2, malformed.stdout + malformed.stderr)
    assert.match(
      malformed.stderr,
      /Credentials with whitespace or a line break in them: GOOGLE_GENERATIVE_AI_API_KEY \(character 5\)/,
    )
  })

  test("a group's or eval's judge needs its key before any attempt, and a malformed one exits 2", async () => {
    const p = await project('eval-judge-key', {
      'reeval.config.ts': `import { direct, vercel } from 'reeval/gateway'${fakeConfig({
        extra: `gateway: [direct(), vercel()],`,
      })}`,
      'evals/own-judge.eval.ts': `import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
export default defineEval({
  judge: { model: 'anthropic/claude-sonnet-5' },
  graders: [judge('Did it?', { inputs: { diff: true } })],
  async task(c) {
    await c.send('x')
  },
})
`,
      'evals/group-judge.eval.ts': `import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
export default defineEval({
  judge: { model: 'openai/gpt-6-luna', gateway: 'vercel' },
  graders: [judge('Did it?', { inputs: { diff: true } })],
  async task(c) {
    await c.send('x')
  },
})
`,
    })
    const noKeys = {
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: '',
      AI_GATEWAY_API_KEY: '',
      VERCEL_OIDC_TOKEN: '',
    }
    const missing = await runCli(p.dir, ['run'], { env: noKeys })
    assert.equal(missing.code, 2, missing.stdout + missing.stderr)
    assert.match(missing.stderr, /anthropic\/claude-sonnet-5/)
    assert.match(missing.stderr, /openai\/gpt-6-luna/)
    assert.doesNotMatch(missing.stdout, /own judge|group judge/, 'no attempt started')
    const malformed = await runCli(p.dir, ['run'], {
      env: { ...noKeys, ANTHROPIC_API_KEY: 'sk-ant\nrest', AI_GATEWAY_API_KEY: 'vck test' },
    })
    assert.equal(malformed.code, 2, malformed.stdout + malformed.stderr)
    assert.match(malformed.stderr, /Credentials with whitespace or a line break in them:/)
    assert.match(malformed.stderr, /ANTHROPIC_API_KEY \(character 7\)/)
    assert.match(malformed.stderr, /AI_GATEWAY_API_KEY \(character 4\)/)
    const narrowed = await runCli(p.dir, ['run', 'own-judge'], { env: noKeys })
    assert.equal(narrowed.code, 2, narrowed.stdout + narrowed.stderr)
    assert.match(narrowed.stderr, /Missing credentials: ANTHROPIC_API_KEY \(for direct\(\)\)/)
    assert.doesNotMatch(narrowed.stderr, /AI_GATEWAY_API_KEY/, 'a filtered-out eval needs no key')
  })

  const judgeKeyCases: Array<[string, string, RegExp]> = [
    [
      'anthropic/claude-sonnet-5',
      'ANTHROPIC_API_KEY',
      /Missing credentials: ANTHROPIC_API_KEY \(for direct\(\)\) for the judge model, "anthropic\/claude-sonnet-5"\. Set them in the environment or \.env\.local\.$/m,
    ],
    [
      'openai/gpt-6-luna',
      'OPENAI_API_KEY',
      /Missing credentials: OPENAI_API_KEY \(for direct\(\)\) for the judge model, "openai\/gpt-6-luna"\./,
    ],
    [
      'mistral/mistral-large',
      'AI_GATEWAY_API_KEY',
      /the judge model "mistral\/mistral-large": no gateway in the list can serve it \(direct: reeval calls only anthropic\/\*, google\/\*, openai\/\*, typesafe-ai\/\* models on their own keys\)\. Add vercel\(\) to gateway\./,
    ],
  ]
  test('a judge model without its key exits 2 naming the keys that work, before any attempt', async () => {
    const noKeys = {
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: '',
      AI_GATEWAY_API_KEY: '',
      VERCEL_OIDC_TOKEN: '',
    }
    for (const [model, key, message] of judgeKeyCases) {
      const p = await project('judge-key', {
        'reeval.config.ts': fakeConfig({
          extra: `profiles: { real: { judge: { model: '${model}' } } },`,
        }),
        'evals/judged.eval.ts': `import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
export default defineEval({
  graders: [judge('Did it?', { inputs: { diff: true } })],
  async task(c) {
    await c.send('x')
  },
})
`,
      })
      const missing = await runCli(p.dir, ['run', '--profile', 'real'], { env: noKeys })
      assert.equal(missing.code, 2, missing.stdout + missing.stderr)
      assert.match(missing.stderr, message)
      if (key === 'AI_GATEWAY_API_KEY') continue
      const unused = await runCli(p.dir, ['run', '--profile', 'real'], {
        env: { ...noKeys, AI_GATEWAY_API_KEY: 'vck_test' },
      })
      assert.equal(unused.code, 2, 'no gateway by default: the Gateway key never stands in')
      assert.match(
        unused.stderr,
        /Set them in the environment or \.env\.local\. AI_GATEWAY_API_KEY is set, but no gateway in the config uses it: add vercel\(\) to gateway to call the model through Vercel AI Gateway\./,
      )
      const malformed = await runCli(p.dir, ['run', '--profile', 'real'], {
        env: { ...noKeys, [key]: 'sk-test\nrest' },
      })
      assert.equal(malformed.code, 2, malformed.stdout + malformed.stderr)
      assert.match(
        malformed.stderr,
        new RegExp(`Credentials with whitespace or a line break in them: ${key} \\(character 8\\)`),
      )
    }
  })

  test('a profile name typo exits 2 and lists the profiles', async () => {
    const p = await fixture('plan/profiles')
    const typo = await runCli(p.dir, ['run', '--profile', 'nigthly'])
    assert.equal(typo.code, 2)
    assert.match(
      typo.stderr,
      /reeval: Unknown profile "nigthly"\. Profiles in reeval\.config\.ts: pr, nightly\./,
    )
  })

  test('a profile limit.agent id no collected eval runs on exits 2, naming the ids they do', async () => {
    const p = await project('limit-harness-unknown', {
      'reeval.config.ts': config(
        `profiles: {
    typo: { limit: { agents: ['cursor'] } },
    one: { limit: { agents: ['a:x', 'cursor'] } },
    tagged: { limit: { agents: ['b:y'] } },
    both: { limit: { agents: ['a:x', 'c:z'] } },
    other: { limit: { agents: ['c:z'] } },
  },`,
        "fakeAgent({ id: 'a:x' })",
      ),
      'evals/plain.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  async task() {

  },
})
`,
      'evals/other.eval.ts': `import { defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'
export default defineEval({
  agents: fakeAgent({ id: 'c:z' }),
  async task() {

  },
})
`,
      'evals/tagged-b.eval.ts': `import { defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'
export default defineEval({
  agents: fakeAgent({ id: 'b:y' }),
  tags: ['slow'],
  async task() {},
})
`,
      'evals/a.eval.ts': `import { defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'
export default defineEval({
  agents: [fakeAgent({ id: 'a:x' }), fakeAgent({ id: 'b:y' })],
  async task() {},
})
`,
    })
    const refused = (ids: string) =>
      new RegExp(
        `reeval: profiles\\.\\w+\\.limit.agents in reeval\\.config\\.ts lists ${ids}, which no eval runs on\\. Agent ids the evals run on: a:x, b:y, c:z\\.`,
      )
    for (const args of [['--dry-run'], []]) {
      const r = await runCli(p.dir, ['run', '--profile', 'typo', ...args])
      assert.equal(r.code, 2, r.stdout + r.stderr)
      assert.match(r.stderr, refused('"cursor"'))
    }
    assert.equal(existsSync(join(p.dir, '.reeval', 'runs')), false, 'nothing ran or recorded')
    const one = await runCli(p.dir, ['run', '--dry-run', '--profile', 'one'])
    assert.equal(one.code, 2, one.stdout + one.stderr)
    assert.match(one.stderr, refused('"cursor"'))
    // An eval the tags leave out still names its harnesses.
    const tagged = await runCli(p.dir, [
      'run',
      '--dry-run',
      '--profile',
      'tagged',
      '--tag',
      '!slow',
    ])
    assert.equal(tagged.code, 0, tagged.stdout + tagged.stderr)
    // A path filter leaves the other file's harnesses unknown: an id that matches none of the
    // loaded files' is accepted while another matches, refused when none does.
    const narrowed = await runCli(p.dir, [
      'run',
      '--dry-run',
      '--profile',
      'both',
      'evals/a.eval.ts',
    ])
    assert.equal(narrowed.code, 0, narrowed.stdout + narrowed.stderr)
    const none = await runCli(p.dir, ['run', '--dry-run', '--profile', 'other', 'evals/a.eval.ts'])
    assert.equal(none.code, 2, none.stdout + none.stderr)
    assert.match(
      none.stderr,
      /lists "c:z", which no eval in the selected files runs on\. Agent ids the evals in the selected files run on: a:x, b:y\./,
    )
  })

  test('budget.duration stops new attempts; the run is marked budget and exits 1', async () => {
    const p = await project('budget-duration', {
      'reeval.config.ts': config(
        `concurrency: 1, budget: { duration: '1s' },`,
        'fakeAgent({ delayMs: 700 })',
      ),
      'evals/slow.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  runs: 4,
  async task(c) {
 await c.send('x') 
  },
})
`,
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 1, r.stdout + r.stderr)
    assert.match(r.stdout, /Budget: 1s reached; running attempts finish, queued ones are skipped/)
    const { run, evals } = readRun(p.dir)
    assert.equal(run.status, 'budget')
    assert.deepEqual(run.budget, { duration: '1s' })
    const outcomes = evals[0]?.attempts.map((a) => a.outcome) ?? []
    assert.ok(outcomes.includes('pass') && outcomes.includes('skipped'), outcomes.join(','))
    assert.deepEqual(recordedRuns(p.dir), [], 'not recorded without --record or record: always')

    // With --record, it's recorded as status budget (compare only takes complete runs as a base).
    const recorded = await runCli(p.dir, ['run', '--record'])
    assert.equal(recorded.code, 1, recorded.stdout + recorded.stderr)
    assert.match(recorded.stdout, /^recorded evals\/\.history\/\S+\.json/m)
    const history = readRun(p.dir, { history: 'evals/.history' })
    assert.equal(history.run.status, 'budget')
  })

  test('a budget-stopped run is auto-recorded in CI and by record: always, with status budget, and is never a compare base', async () => {
    const files = (record: string) => ({
      'reeval.config.ts': config(
        `concurrency: 1, budget: { duration: '1s' },${record}`,
        'fakeAgent({ delayMs: 1500 })',
      ),
      'evals/slow.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  runs: 4,
  async task(c) {
 await c.send('x') 
  },
})
`,
    })
    const ci = await project('budget-record-ci', files(''))
    const inCI = await runCli(ci.dir, ['run'], { env: { CI: '1' } })
    assert.equal(inCI.code, 1, inCI.stdout + inCI.stderr)
    assert.match(inCI.stdout, /^recorded evals\/\.history\/\S+\.json/m)
    assert.equal(readRun(ci.dir, { history: 'evals/.history' }).run.status, 'budget')
    const compared = await runCli(ci.dir, ['compare', '--json'])
    assert.equal(JSON.parse(compared.stdout).base, null, 'a budget run is never the base')

    const always = await project('budget-record-always', files(` record: 'always',`))
    assert.equal((await runCli(always.dir)).code, 1)
    const [runId] = recordedRuns(always.dir)
    assert.ok(runId, 'recorded by record: always')
    assert.equal(readRun(always.dir, { history: 'evals/.history' }).run.status, 'budget')

    // Canary: record: 'manual' leaves it to reeval record, which refuses it without --allow-incomplete.
    const manual = await project('budget-record-manual', files(` record: 'manual',`))
    assert.equal((await runCli(manual.dir, ['run'], { env: { CI: '1' } })).code, 1)
    assert.deepEqual(recordedRuns(manual.dir), [])
    const refused = await runCli(manual.dir, ['record', 'latest'])
    assert.equal(refused.code, 2, refused.stdout + refused.stderr)
    assert.equal((await runCli(manual.dir, ['record', 'latest', '--allow-incomplete'])).code, 0)
    assert.equal(readRun(manual.dir, { history: 'evals/.history' }).run.status, 'budget')
  })
})

describe('common mistakes', { concurrency: 4 }, () => {
  describe('refused in-process', () => {
    // Each refusal here happens while reeval collects the eval file or resolves the config, so the
    // rows run that in-process, as a worker does; test/refusals/ holds the contract's own checks
    // to golden messages, and the CLI rows below hold the wiring: exit 2 and the message printed.
    const root = tempDir('mistakes')
    const a = defineEnvironment('a', {})
    const b = defineEnvironment('b', {})
    const fakeConfigInput = (environment = true) => ({
      agents: fakeAgent({}),
      sandbox: fakeSandbox({ dir: join(root, 'sandboxes') }),
      ...(environment ? { environments: defineEnvironment('fake', {}) } : {}),
      judge: { model: fakeJudge({ score: 0.9 }) },
    })
    let files = 0

    /**
     * What collecting an eval file that runs `declare` refuses, under `fakeConfig()`'s config, or
     * `null` when it plans.
     */
    const evalSpec = (declare: () => unknown): object => {
      const result = declare()
      if (result !== undefined && typeof result === 'object' && result !== null) {
        if (
          'task' in result ||
          'cases' in result ||
          'runs' in result ||
          'compare' in result ||
          'agents' in result
        )
          return result as object
        return { environment: result, task: async () => {} }
      }
      return { task: async () => {} }
    }

    async function refusal(
      declare: () => unknown,
      config = fakeConfigInput(),
    ): Promise<string | null> {
      const run: RunContext = {
        runId: 'r',
        stagingDir: root,
        config: resolveConfig(config, root),
        tags: [],
        concurrency: 1,
        profile: null,
      }
      useEngine({
        registerTest,
        getRunContext: () => run,
        collectingFile,
        declarePlanned: () => {},
      })
      const file = join(root, `evals/m${++files}.eval.ts`)
      ;(globalThis as Record<symbol, unknown>)[Symbol.for('reeval.defined')] = []
      try {
        await collect(file, async () =>
          declareDefault(file, { default: defineEval(evalSpec(declare)) }),
        )
      } catch (error) {
        return (error as Error).message
      }
      return null
    }

    const W = /evals\/m\d+\.eval\.ts/

    const cases: Array<[string, () => unknown, RegExp]> = [
      [
        'a question that shows the model nothing',
        () => ({
          question: { model: 'google/gemini-3.8-flash' },
          questions: [{ question: 'Q', diff: false, output: false, trajectory: false }],
          task: async () => {},
        }),
        /questions "Q" in evals\/m\d+\.eval\.ts shows the model nothing:/,
      ],
      [
        'a variant with its own checks',
        () => ({
          compare: { control: a, variants: [{ environment: a, check: () => {} } as never] },
          task: async () => {},
        }),
        /compare\.variants in evals\/m\d+\.eval\.ts must be environments from defineEnvironment/,
      ],
      [
        'compare scoped to a harness the eval does not run',
        () => ({
          compare: { control: b, variants: [a], agents: ['sonnet'] },
          task: async () => {},
        }),
        /compare\.agents lists sonnet, which evals\/m\d+\.eval\.ts doesn't run/,
      ],
      [
        'compare arms whose refs come from unset variables',
        () => {
          const base = defineEnvironment('base', ({ git }) => ({
            workspace: git('..', { ref: process.env.REEVAL_TEST_UNSET_BASE }),
          }))
          const head = base.extendEnvironment('head', ({ git }) => ({
            workspace: git('..', { ref: process.env.REEVAL_TEST_UNSET_HEAD }),
          }))
          return { compare: { control: base, variants: [head] }, task: async () => {} }
        },
        /compare in evals\/m\d+\.eval\.ts runs head and base on the same tree/,
      ],
      [
        'a variant that is the control',
        () => ({
          environment: a,
          compare: { control: a, variants: [a, b] },
          task: async () => {},
        }),
        /sets both environments and compare\. With compare, the control is compare\.control/,
      ],
      [
        'a pairwise question across environments without a compare',
        () => ({
          environment: a,
          questions: [{ question: 'Which?', across: 'environment', diff: true }],
          task: async () => {},
        }),
        /questions "Which\?" in evals\/m\d+\.eval\.ts varies the environment \(across: 'environment'\)/,
      ],
      [
        'a pairwise question across harnesses on one harness',
        () => ({
          compare: { control: a, variants: [b] },
          questions: [{ question: 'Which?', across: 'harness', diff: true }],
          task: async () => {},
        }),
        /questions "Which\?" in evals\/m\d+\.eval\.ts: across is 'environment'.*Did you mean 'agent'\?/,
      ],
      [
        'pinning something that cannot be pinned',
        () => ({ pin: ['timeout'] as never, task: async () => {} }),
        /pin in evals\/m\d+\.eval\.ts lists agents, runs and\/or compare \(got "timeout"\)/,
      ],
      [
        'a harness edit naming a harness the eval does not inherit',
        () => ({ agents: { only: 'cursor' }, task: async () => {} }),
        /agents \{ only: "cursor" \} in evals\/m\d+\.eval\.ts names no inherited agent/,
      ],
      [
        'a harness edit that adds and keeps at once',
        () => ({ agents: { add: [], only: 'fake' } as never, task: async () => {} }),
        /agents in evals\/m\d+\.eval\.ts takes \{ add \} or \{ only \}, not both/,
      ],
      [
        'repeat instead of runs',
        () => ({ repeat: 3, task: async () => {} }) as never,
        /Unknown option "repeat".*Did you mean "runs"\?/,
      ],
      [
        'an eval with no function',
        () => ({ runs: 2 }),
        /its eval has no task\. Give defineEval the eval's body/,
      ],
      [
        'two cases with the same key',
        () => ({ cases: [{ key: 'a' }, { key: 'a' }], task: async () => {} }),
        /cases\[0\] and cases\[1\] in evals\/m\d+\.eval\.ts have the same key "a"/,
      ],
      [
        'cases whose keys mask to the same key',
        () => ({
          cases: [{ key: `sk-ant-${'a'.repeat(24)}` }, { key: `sk-ant-${'b'.repeat(24)}` }],
          task: async () => {},
        }),
        /evals\/m\d+\.eval\.ts case "\[REDACTED\]" names a secret, and its masked name is another case's in this eval/,
      ],
      [
        'a zero timeout',
        () => ({ timeout: 0, task: async () => {} }),
        /Invalid duration 0\. A duration is more than zero/,
      ],
      [
        'a timeout longer than a timer can be',
        () => ({ timeout: '1000h', task: async () => {} }),
        /Invalid duration "1000h"/,
      ],
      [
        'a file path that climbs out of the home directory',
        () => defineEnvironment('e', { files: { '~/../../x': 'x' } }),
        /files\["~\/\.\.\/\.\.\/x"\] in defineEnvironment\("e"\): paths .* never use \.\./,
      ],
      [
        'runs 0',
        () => ({ runs: 0, task: async () => {} }),
        /runs in evals\/m\d+\.eval\.ts must be a whole number of at least 1 \(got 0\)/,
      ],
      [
        'threshold instead of target',
        () => ({ threshold: 0.8, task: async () => {} }) as never,
        /Unknown option "threshold" in evals\/m\d+\.eval\.ts\. Did you mean "target"\?/,
      ],
      [
        'no harness',
        () => ({ agents: [], task: async () => {} }),
        /agents is an empty list in evals\/m\d+\.eval\.ts/,
      ],
      [
        'an empty hosts list',
        () =>
          defineEnvironment('k', ({ secret }) => ({
            env: { K: secret.fromEnv('K', { hosts: [] }) },
          })),
        /secret\.fromEnv\("K"\): hosts must list the hosts the secret is sent to/,
      ],
      [
        'a URL as a host',
        () =>
          defineEnvironment('k', ({ secret }) => ({
            env: { K: secret.fromEnv('K', { hosts: ['https://api.example.com/v1'] }) },
          })),
        /secret\.fromEnv\("K"\): hosts are host names, not URLs/,
      ],
      [
        'a host that is not a string',
        () =>
          defineEnvironment('k', ({ secret }) => ({
            env: { K: secret.fromEnv('K', { hosts: [42 as never] }) },
          })),
        /secret\.fromEnv\("K"\): 42 isn't a host/,
      ],
      [
        'in without hosts',
        () =>
          defineEnvironment('k', ({ secret }) => ({
            env: { K: secret.fromEnv('K', { in: ['query'] }) },
          })),
        /secret\.fromEnv\("K"\): in only applies to a brokered secret/,
      ],
      [
        'a short-form IPv4 address in an egress allowlist',
        () => ({ egress: { allow: ['10.1'] }, task: async () => {} }),
        /egress\.allow in evals\/m\d+\.eval\.ts: '10\.1' isn't a host name or an IPv4 address/,
      ],
      [
        'the network policy under another name',
        () => ({ network: 'deny-all', task: async () => {} }) as never,
        /Unknown option "network" in evals\/m\d+\.eval\.ts\. Did you mean "egress"\?/,
      ],
      [
        'deny-all on the fake sandbox',
        () => ({ egress: 'deny-all', task: async () => {} }),
        /evals\/m\d+\.eval\.ts runs under egress 'deny-all', which needs turning egress off/,
      ],
      [
        "an environment's allowlist on the fake sandbox",
        () => ({
          environment: defineEnvironment('n', {
            sandbox: fakeSandbox(),
            egress: { allow: ['api.example.com'] },
          }),
          task: async () => {},
        }),
        /evals\/m\d+\.eval\.ts runs under egress \{ allow: \['api\.example\.com'\] \}, which needs a host allowlist/,
      ],
      [
        'two harnesses with one id',
        () => ({ agents: [fakeAgent(), fakeAgent()], task: async () => {} }),
        /Two agents in evals\/m\d+\.eval\.ts resolve to the id "fake"/,
      ],
      [
        'the singular plugin key',
        () =>
          defineEnvironment('review', (({ plugin }: EnvironmentHelpers) => ({
            plugin: [plugin.local('.')],
          })) as never),
        /Unknown field "plugin" in defineEnvironment\("review"\)\. Did you mean "plugins"\?/,
      ],
      [
        'a plugin only as a string',
        () =>
          defineEnvironment('review', ({ plugin }) => ({
            plugins: [plugin.local('.', { only: 'skills' as never })],
          })),
        /plugin\.local\("\."\): only lists the parts to place/,
      ],
      [
        'capture as a number',
        () => ({ capture: 5173 as never, task: async () => {} }),
        /capture in evals\/m\d+\.eval\.ts is \{ viewport\?, timeout\?, browser\?, model\? \} \(got 5173\)/,
      ],
      [
        'an unknown capture key',
        () => ({ capture: { ready: true } as never, task: async () => {} }),
        /Unknown capture key "ready" in evals\/m\d+\.eval\.ts/,
      ],
      [
        'capture.port on evaluate',
        () => ({ capture: { port: 5173 } as never, task: async () => {} }),
        /Unknown capture key "port" in evals\/m\d+\.eval\.ts/,
      ],
      [
        'a capture viewport without height',
        () => ({ capture: { viewport: { width: 1280 } as never }, task: async () => {} }),
        /capture\.viewport in evals\/m\d+\.eval\.ts is \{ width, height \} or 'full-page'/,
      ],
      [
        'capture.browser as a string',
        () => ({ capture: { browser: 'off' as never }, task: async () => {} }),
        /capture\.browser in evals\/m\d+\.eval\.ts is true or false \(got "off"\)/,
      ],
      [
        'a capture viewport with height and fullPage',
        () => ({
          capture: { viewport: { height: 720, fullPage: true } as never },
          task: async () => {},
        }),
        /capture\.viewport in evals\/m\d+\.eval\.ts is \{ width, height \} or 'full-page', not \{ height, fullPage \}/,
      ],
      [
        'instructions without a vision model',
        () => ({ capture: { instructions: ['Fill the form'] } as never, task: async () => {} }),
        /capture\.instructions in evals\/m\d+\.eval\.ts can't be set/,
      ],
      [
        'an evaluation-model capture.model',
        () => ({ capture: { model: 'typesafe-ai/jev-1.14.0' }, task: async () => {} }),
        /capture\.model "typesafe-ai\/jev-1\.14\.0" in evals\/m\d+\.eval\.ts is an evaluation model/,
      ],
      [
        'leftover capture.use',
        () => ({
          capture: { use: { model: 'google/gemini-3.8-flash' } } as never,
          task: async () => {},
        }),
        /Unknown capture key "use" in evals\/m\d+\.eval\.ts/,
      ],
      [
        'leftover capture.fake',
        () => ({ capture: { fake: [] } as never, task: async () => {} }),
        /Unknown capture key "fake" in evals\/m\d+\.eval\.ts/,
      ],
    ]
    for (const [what, declare, message] of cases) {
      test(`${what} is refused with a fix`, async () => {
        assert.match(String(await refusal(declare)), message)
      })
    }

    test('compare arms on one workspace that differ in something else plan', async () => {
      const base = defineEnvironment('base', ({ git }) => ({ workspace: git('..') }))
      const skilled = base.extendEnvironment('skilled', ({ git }) => ({
        workspace: git('..'),
        files: { 'SKILL.md': 'x' },
      }))
      assert.equal(
        await refusal(() => ({
          compare: { control: base, variants: [skilled] },
          task: async () => {},
        })),
        null,
      )
    })

    const configCases: Array<[string, Record<string, unknown>, RegExp]> = [
      [
        'a literal secret',
        { env: { GOOGLE_API_KEY: 'AIza-not-really' } },
        /env\.GOOGLE_API_KEY in reeval\.config\.ts is a literal string\. Pass secrets with secret\.fromEnv\(\) so they're redacted and never recorded\./,
      ],
      [
        'widening in a profile limit',
        { profiles: { pr: { limit: { agents: [fakeAgent({ id: 'a' })] } } } },
        /profiles\.pr\.limit\.agents in reeval\.config\.ts can only list agent ids to allow \(got fakeAgent\(\{ … \}\)\)\. To add agents, use profiles\.pr\.defaults\.agents\./,
      ],
      [
        'a usd budget',
        { budget: { usd: 20 } },
        /budget\.usd in reeval\.config\.ts isn't supported yet: reeval records the tokens and cost of each attempt, but enforces no cost or token budget\. Cap the run with attempts or duration\./,
      ],
      [
        'an unbrokered policy reeval does not know',
        { secrets: { unbrokered: 'deny' } },
        /secrets\.unbrokered in reeval\.config\.ts is 'warn' or 'error' \(got "deny"\)/,
      ],
      [
        'maxConcurrent 0 on a config harness',
        { agents: fakeAgent({ maxConcurrent: 0 }) },
        /agents\.maxConcurrent in reeval\.config\.ts must be a whole number of at least 1 \(got 0\)/,
      ],
      [
        'a judge diff option in the config',
        { judge: { model: fakeJudge({ score: 0.9 }), diff: ['src/'] } },
        /Unknown judge option "diff" in reeval\.config\.ts\. diff is a judge grader's input: judge\(question, \{ inputs: \{ diff \} \}\)\./,
      ],
      [
        'a judge contents option in the config',
        { judge: { model: fakeJudge({ score: 0.9 }), contents: ['README.md'] } },
        /Unknown judge option "contents" in reeval\.config\.ts\. contents is a judge grader's input: judge\(question, \{ inputs: \{ contents \} \}\)\./,
      ],
      [
        'a judge.state in the config',
        { judge: { model: fakeJudge({ score: 0.9 }), state: { trajectory: true } } },
        /Unknown judge option "state" in reeval\.config\.ts\./,
      ],
      [
        'keeping no debug runs',
        { debug: { keep: 0 } },
        /debug\.keep in reeval\.config\.ts must be a whole number of at least 1 \(got 0\)/,
      ],
      [
        'a trace buffer size as text',
        { debug: { traceBufferMb: '8MB' } },
        /debug\.traceBufferMb in reeval\.config\.ts must be a number of megabytes above 0 \(got "8MB"\)/,
      ],
      [
        'a debug folder option',
        { debug: { dir: '/tmp/debug' } },
        /Unknown option "dir" in debug in reeval\.config\.ts\. Use keep, traceBufferMb\./,
      ],
      [
        'control reuse',
        { profiles: { pr: { reuse: 'control' } } },
        /Unknown option "reuse" in profiles\.pr in reeval\.config\.ts\. Reusing control results from \.history isn’t built yet/,
      ],
      [
        'a sandbox that is not one of the sandbox helpers on defineConfig',
        { sandbox: { kind: 'vm' } },
        /sandbox in reeval\.config\.ts must come from docker\(\), podman\(\), fakeSandbox\(\) or tart\(\)/,
      ],
      [
        'a sandbox that is not one of the sandbox helpers on profile defaults',
        { profiles: { pr: { defaults: { sandbox: { kind: 'vm' } } } } },
        /sandbox in profiles\.pr\.defaults in reeval\.config\.ts must come from docker\(\), podman\(\), fakeSandbox\(\) or tart\(\)/,
      ],
    ]
    for (const [what, extra, message] of configCases) {
      test(`${what} in the config is refused with a fix`, () => {
        assert.throws(
          () =>
            resolveConfig({ ...fakeConfigInput(), ...extra } as never, root, 'reeval.config.ts'),
          message,
        )
      })
    }
  })

  const cliCases: Array<[string, Record<string, string>, RegExp]> = [
    [
      'a refusal while the eval file loads',
      {
        'reeval.config.ts': fakeConfig(),
        'evals/o.eval.ts': `import { defineEnvironment } from 'reeval'
defineEnvironment('py', { dockerfile: './Dockerfile' } as never)
`,
      },
      /^reeval: evals\/o\.eval\.ts: "dockerfile" isn't an environment field \(defineEnvironment\("py"\)\)\. Put the image on the sandbox: sandbox: docker\(\{ dockerfile: … \}\)/m,
    ],
    [
      'a refusal while the eval is planned',
      {
        'reeval.config.ts': fakeConfig(),
        'evals/e.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
const a = defineEnvironment('a', {})
const b = defineEnvironment('b', {})
export default defineEval({
  compare: { control: b, variants: [a], agents: ['sonnet'] },
  async task() {},
})
`,
      },
      /^reeval: evals\/e\.eval\.ts: compare\.agents lists sonnet, which evals\/e\.eval\.ts doesn't run \(it runs fake\)\./m,
    ],
    [
      'a plugin without a manifest',
      {
        'reeval.config.ts': fakeConfig(),
        'evals/e.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
export default defineEval({
  environment: defineEnvironment('review', ({ plugin }) => ({ plugins: [plugin.local('..')] })),
  async task() {

  },
})
`,
      },
      /evals\/e\.eval\.ts: evals\/e\.eval\.ts on fake: plugin\.local\('\.'\) has no \.claude-plugin\/plugin\.json/,
    ],
  ]
  for (const [what, files, message] of cliCases) {
    test(`${what} exits 2 with a fix`, async () => {
      const p = await project('mistake', files)
      const r = await runCli(p.dir)
      assert.equal(r.code, 2, r.stdout + r.stderr)
      assert.match(r.stderr, message)
    })
  }

  test('no reeval.config.* here or above exits 2 with a fix', async () => {
    const p = await project('no-config', {})
    const missing =
      /^reeval: No reeval\.config\.ts \(or reeval\.config\.mts, reeval\.config\.cts, reeval\.config\.js, reeval\.config\.mjs, reeval\.config\.cjs, reeval\.yaml, reeval\.yml\) here or above\. Run reeval init\.\n$/
    for (const argv of [
      ['run'],
      ['run', '--dry-run'],
      ['image', 'build'],
      ['image', 'build', '--dry-run'],
    ]) {
      const r = await runCli(p.dir, argv)
      assert.equal(r.code, 2, `${argv.join(' ') || 'run'}\n${r.stdout}${r.stderr}`)
      assert.match(r.stderr, missing, argv.join(' ') || 'run')
    }
  })

  test('a reeval.yaml mistake, or a reeval.yaml beside reeval.config.ts, exits 2', async () => {
    const p = await project('yaml-mistake', {
      'reeval.yaml':
        'agents: { kind: fake }\nsandbox: { kind: fake }\nhistory: { artifact: all }\n',
      'evals/a.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ async task() {} })
`,
    })
    const typo = await runCli(p.dir, ['run', '--dry-run'])
    assert.equal(typo.code, 2, typo.stdout + typo.stderr)
    assert.match(
      typo.stderr,
      /^reeval: Unknown option "artifact" in history in reeval\.yaml\. Did you mean "artifacts"\?\n$/,
    )
    writeFileSync(join(p.dir, 'reeval.config.ts'), 'export default {}\n')
    const both = await runCli(p.dir, ['run', '--dry-run'])
    assert.equal(both.code, 2, both.stdout + both.stderr)
    assert.match(
      both.stderr,
      /^reeval: reeval\.config\.ts and reeval\.yaml are both in \.: reeval reads one config per directory\. Keep one, or pass --config\.\n$/,
    )
  })

  test('--profile picks the history store a command reads, as REEVAL_PROFILE does', async () => {
    const p = await project('profile-history', {
      'reeval.yaml': [
        'agents: { kind: fake }',
        'sandbox: { kind: fake }',
        'profiles:',
        '  ci:',
        '    history: { store: { kind: s3, bucket: runs } }',
        '',
      ].join('\n'),
      'evals/a.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ async task() {} })
`,
    })
    const local = await runCli(p.dir, ['history'])
    assert.equal(local.code, 0, local.stdout + local.stderr)
    const remote =
      /^reeval: reeval studio reads a local\(\) history only, and history\.store in reeval\.yaml keeps runs in s3:\/\/runs\./
    for (const [args, env] of [
      [['studio', '--no-open', '--profile', 'ci'], {}],
      [['studio', '--no-open'], { REEVAL_PROFILE: 'ci' }],
    ] as const) {
      const r = await runCli(p.dir, [...args], { env })
      assert.equal(r.code, 2, r.stdout + r.stderr)
      assert.match(r.stderr, remote, args.join(' '))
    }
    const plan = await runCli(p.dir, ['run', '--profile', 'ci', '--dry-run'])
    assert.equal(plan.code, 0, plan.stdout + plan.stderr)
    const unknown = await runCli(p.dir, ['show', '--profile', 'nope'])
    assert.equal(unknown.code, 2, unknown.stdout + unknown.stderr)
    assert.match(unknown.stderr, /Unknown profile "nope"\. Profiles in reeval\.yaml: ci\./)
    writeFileSync(join(p.dir, '.env'), 'REEVAL_PROFILE=ci\n')
    const fromEnv = await runCli(p.dir, ['studio', '--no-open'])
    assert.equal(fromEnv.code, 2, fromEnv.stdout + fromEnv.stderr)
    assert.match(fromEnv.stderr, remote, 'REEVAL_PROFILE in .env')
  })

  test('config errors name the config file that was read, as typed from the current directory', async () => {
    const bad = (extra: string) =>
      config(extra).replace(
        "import { defineConfig } from 'reeval'",
        "import { defineConfig, defineEnvironment } from 'reeval'",
      )
    const p = await project('config-path', {
      'reeval.config.ts': bad('agent: [],'),
      'reeval.compare.config.ts': bad(`compare: { variants: [defineEnvironment('x', {})] },`),
      'reeval.secret.config.ts': bad(`env: { GOOGLE_API_KEY: 'AIza-not-really' },`),
      'reeval.empty.config.ts': bad('agents: [],'),
      'reeval.none.config.ts': fakeConfig().replace(
        'export default defineConfig({',
        'defineConfig({',
      ),
      'reeval.profile.config.ts': bad(`profiles: { pr: {} },`),
      'reeval.budget.config.ts': bad('budget: { attempts: 1 },'),
      'reeval.include.config.ts': bad(`include: ['nothing/**/*.eval.ts'],`),
      'reeval.judge.config.ts': bad('').replace('judge: { model: fakeJudge({ score: 0.9 }) },', ''),
      'reeval.unbrokered.config.ts': bad(`secrets: { unbrokered: 'error' },`),
      'evals/e.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  runs: 2,
  async task() {

  },
})
`,
      'evals/judged.eval.ts': `import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
export default defineEval({
  graders: [judge('ok?', { inputs: { diff: true } })],
  async task(c) {
    await c.send('x')
  },
})
`,
      'evals/one.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'
const env = defineEnvironment('one', ({ secret }) => ({
  sandbox: docker(),
  env: { AWS_SECRET_ACCESS_KEY: secret() },
}))
export default defineEval({
  environment: env,
  async task() {},
})
`,
    })
    const cases: Array<[string, string[], RegExp]> = [
      ['.', [], /Unknown option "agent" in reeval\.config\.ts\. Did you mean "agents"\?/],
      ['evals', [], /Unknown option "agent" in \.\.\/reeval\.config\.ts\. Did you mean "agents"\?/],
      [
        '.',
        ['--config', 'reeval.compare.config.ts'],
        /compare can't be set in reeval\.compare\.config\.ts:/,
      ],
      [
        '.',
        ['--config', 'reeval.secret.config.ts'],
        /env\.GOOGLE_API_KEY in reeval\.secret\.config\.ts is a literal string/,
      ],
      [
        '.',
        ['--config', 'reeval.empty.config.ts'],
        /agents is an empty list in reeval\.empty\.config\.ts\./,
      ],
      [
        'evals',
        ['--config', '../reeval.none.config.ts'],
        /^reeval: \.\.\/reeval\.none\.config\.ts has no default export/m,
      ],
      [
        '.',
        ['--config', 'reeval.profile.config.ts', '--profile', 'nope'],
        /Profiles in reeval\.profile\.config\.ts: pr\./,
      ],
      [
        '.',
        ['--config', 'reeval.budget.config.ts', 'e.eval'],
        /over budget\.attempts 1 \(reeval\.budget\.config\.ts\)/,
      ],
      [
        '.',
        ['--config', 'reeval.include.config.ts'],
        /or set include in reeval\.include\.config\.ts\./,
      ],
      [
        '.',
        ['--config', 'reeval.unbrokered.config.ts', 'one.eval'],
        /secrets\.unbrokered is 'error' in reeval\.unbrokered\.config\.ts\./,
      ],
    ]
    await Promise.all(
      cases.map(async ([cwd, args, message]) => {
        const r = await runCli(join(p.dir, cwd), ['run', ...args], {
          env: { AWS_SECRET_ACCESS_KEY: 'not-a-real-secret-value' },
        })
        assert.equal(r.code, 2, `${args.join(' ')}\n${r.stdout}${r.stderr}`)
        assert.match(r.stderr, message)
        if (args.length)
          assert.doesNotMatch(r.stderr, /(?<![\w./])reeval\.config\.ts/, args.join(' '))
      }),
    )
    const judged = await runCli(p.dir, ['run', '--config', 'reeval.judge.config.ts', 'judged.eval'])
    assert.equal(judged.code, 2, judged.stdout + judged.stderr)
    assert.match(
      judged.stderr,
      /Set judge: \{ model: 'typesafe-ai\/jev-1\.14\.0' \} in reeval\.judge\.config\.ts,/,
    )
  })

  for (const [what, replacement, message] of [
    [
      'no export',
      'defineConfig({',
      /reeval\.config\.ts has no default export\. Write export default defineConfig\(\{…\}\)\./,
    ],
    [
      'a named export',
      'export const config = defineConfig({',
      /reeval\.config\.ts has no default export \(it exports config\)\. Write export default defineConfig\(\{…\}\)\./,
    ],
  ] as const) {
    test(`a config with ${what} exits 2 instead of running the default harness`, async () => {
      const p = await project('config-no-default', {
        'reeval.config.ts': fakeConfig().replace('export default defineConfig({', replacement),
        'evals/e.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  async task() {

  },
})
`,
      })
      const r = await runCli(p.dir, ['run', '--dry-run'])
      assert.equal(r.code, 2, r.stdout + r.stderr)
      assert.match(r.stderr, message)
    })
  }

  const unbrokeredEval = (id: string) => `import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'
const keys = defineEnvironment('keys', ({ secret }) => ({
  sandbox: docker(),
  env: {
    GEMINI_API_KEY: secret.fromEnv('HOST_GEMINI', { hosts: secret.hosts.gemini }),
    AWS_SECRET_ACCESS_KEY: secret(),
  },
}))
export default defineEval({ environment: keys, async task() {} })
`

  test("an optional secret that isn't set gets no real-value warning; set, it does", async () => {
    const p = await project('unbrokered-optional', {
      'reeval.config.ts': fakeConfig(),
      'evals/one.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'
const maybe = defineEnvironment('maybe', ({ secret }) => ({
  sandbox: docker(),
  env: { SENTRY_TOKEN: secret.fromEnv('REEVAL_TEST_MAYBE_TOKEN', { optional: true }) },
}))
export default defineEval({ environment: maybe, async task() {} })
`,
    })
    const warning = /SENTRY_TOKEN is in the sandbox as its real value/
    const unset = await runCli(p.dir, ['run', '--dry-run'])
    assert.equal(unset.code, 0, unset.stdout + unset.stderr)
    assert.doesNotMatch(unset.stdout, warning)
    // The canary: set on the host, it does reach the sandbox as its real value.
    const set = await runCli(p.dir, ['run', '--dry-run'], {
      env: { REEVAL_TEST_MAYBE_TOKEN: 'set-for-the-canary' },
    })
    assert.match(set.stdout, warning)
  })

  test("secrets: { unbrokered: 'error' } refuses an optional secret whether or not it's set", async () => {
    const p = await project('unbrokered-optional-strict', {
      'reeval.config.ts': fakeConfig({ extra: "secrets: { unbrokered: 'error' }," }),
      'evals/one.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'
const maybe = defineEnvironment('maybe', ({ secret }) => ({
  sandbox: docker(),
  env: { SENTRY_TOKEN: secret.fromEnv('REEVAL_TEST_MAYBE_TOKEN', { optional: true }) },
}))
export default defineEval({ environment: maybe, async task() {} })
`,
    })
    const refused =
      /SENTRY_TOKEN in evals\/one\.eval\.ts isn't brokered, and secrets\.unbrokered is 'error'/
    for (const env of [{}, { REEVAL_TEST_MAYBE_TOKEN: 'set-on-this-host' }]) {
      const r = await runCli(p.dir, ['run', '--dry-run'], { env })
      assert.equal(r.code, 2, r.stdout + r.stderr)
      assert.match(r.stderr, refused)
    }
  })

  test('a Docker secret without hosts warns once in the plan', async () => {
    const p = await project('unbrokered', {
      'reeval.config.ts': fakeConfig(),
      'evals/one.eval.ts': unbrokeredEval('one'),
      'evals/two.eval.ts': unbrokeredEval('two'),
    })
    const r = await runCli(p.dir, ['run', '--dry-run'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const warning =
      /^ {2}⚠ {2}Warning: AWS_SECRET_ACCESS_KEY is in the sandbox as its real value\. To give the agent only a placeholder, add the hosts it's sent to, e\.g\. secret\.fromEnv\('AWS_SECRET_ACCESS_KEY', \{ hosts: \['api\.example\.com'\] \}\)\.$/gm
    assert.equal(r.stdout.match(warning)?.length, 1, r.stdout)
    assert.doesNotMatch(r.stdout, /GEMINI_API_KEY is in the sandbox/)
  })

  test("secrets: { unbrokered: 'error' } refuses a Docker secret without hosts", async () => {
    const p = await project('unbrokered-strict', {
      'reeval.config.ts': fakeConfig({ extra: "secrets: { unbrokered: 'error' }," }),
      'evals/one.eval.ts': unbrokeredEval('one'),
      'evals/two.eval.ts': unbrokeredEval('two'),
    })
    const r = await runCli(p.dir, ['run', '--dry-run'])
    assert.equal(r.code, 2, r.stdout + r.stderr)
    assert.match(
      r.stderr,
      /AWS_SECRET_ACCESS_KEY in evals\/(one|two)\.eval\.ts isn't brokered, and secrets\.unbrokered is 'error' in reeval\.config\.ts\. To broker it, add the hosts it's sent to, e\.g\. secret\.fromEnv\('AWS_SECRET_ACCESS_KEY', \{ hosts: \['api\.example\.com'\] \}\)\./,
    )
  })

  test("secrets: { unbrokered: 'error' } refuses a to: 'checks' secret without hosts before setup runs", async () => {
    const serverEval = (secret: string) => `import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'
const server = defineEnvironment('server', ({ secret }) => ({
  sandbox: docker(),
  env: { CHECK_TOKEN: ${secret} },
  setup: ['nohup sleep 600 >/dev/null 2>&1 &'],
}))
export default defineEval({ environment: server, async task() {} })
`
    const config = fakeConfig({ extra: "secrets: { unbrokered: 'error' }," })
    const env = { CHECK_TOKEN: 'set-on-this-host' }
    const p = await project('unbrokered-checks-strict', {
      'reeval.config.ts': config,
      'evals/one.eval.ts': serverEval("secret({ to: 'checks' })"),
    })
    const r = await runCli(p.dir, ['run'], { env })
    assert.equal(r.code, 2, r.stdout + r.stderr)
    assert.match(
      r.stderr,
      /CHECK_TOKEN in evals\/one\.eval\.ts isn't brokered, and secrets\.unbrokered is 'error' in reeval\.config\.ts\./,
    )
    // Twin: brokered with hosts, the same eval plans.
    const brokered = await project('unbrokered-checks-brokered', {
      'reeval.config.ts': config,
      'evals/one.eval.ts': serverEval("secret({ to: 'checks', hosts: ['api.example.com'] })"),
    })
    const ok = await runCli(brokered.dir, ['run', '--dry-run'], { env })
    assert.equal(ok.code, 0, ok.stdout + ok.stderr)
  })

  test('a moving git ref warns in the plan', async () => {
    const p = await project('moving-ref', {
      'reeval.config.ts': fakeConfig(),
      'evals/e.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
const main = defineEnvironment('skill@main', ({ skill }) => ({
  skills: [skill.git('github:invertase/genkit-skills', { ref: 'main' })],
}))
export default defineEval({ environment: main, async task() {} })
`,
    })
    const r = await runCli(p.dir, ['run', '--dry-run'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.match(
      r.stdout,
      /^ {2}⚠ {2}Warning: skill\.git\(github:invertase\/genkit-skills\) uses moving ref "main": results aren't comparable over time\. Pin a tag or SHA \(the resolved commit is recorded either way\)\.$/m,
    )
  })
})

describe('environments and secrets', () => {
  test('skills, MCP, rules, files, setup steps and secrets reach the sandbox and the record', async () => {
    const p = await project('environments', {
      'reeval.config.ts': `
import { defineConfig, defineEnvironment } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'
import { fakeJudge } from 'reeval/judge'
export default defineConfig(({ secret }) => ({
  agents: fakeAgent({}),
  environments: defineEnvironment('fake', { sandbox: fakeSandbox({ dir: new URL('./sandboxes', import.meta.url) }) }),
  judge: { model: fakeJudge({ score: 0.9 }) },
  env: { APP_TOKEN: secret.fromEnv('REEVAL_TEST_HOST_TOKEN'), MODE: 'test' },
}))
`,
      'skills/house-greeting/SKILL.md': SKILL,
      'skills/house-greeting/examples.md': 'Ahoy, Ada!\n',
      'docs/api.md': '# API\n',
      'evals/envs.ts': `import { defineEnvironment } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
const sandbox = fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })
export const plain = defineEnvironment('plain', { sandbox })
export const withSkill = defineEnvironment('with-skill', ({ file, mcp, secret, skill }) => ({
  sandbox,
  skills: [skill.local('../skills')],
  mcp: { docs: mcp.stdio('npx', ['-y', 'docs-mcp', '--port', '0']) },
  rules: 'Always write tests.',
  files: { 'notes/readme.txt': 'hello', 'docs/api.md': file('../docs/api.md') },
  env: {
    FLAVOR: 'mint',
    EXTRA_TOKEN: secret.fromEnv('REEVAL_TEST_HOST_TOKEN'),
    CHECK_TOKEN: secret.fromEnv('REEVAL_TEST_HOST_TOKEN', { to: 'checks' }),
    MAYBE_TOKEN: secret.fromEnv('REEVAL_TEST_NOT_SET', { optional: true }),
  },
  setup: [{ run: 'printf %s "$EXTRA_TOKEN$CHECK_TOKEN" | wc -c > secret-length.txt', timeout: '10s' }],
}))
`,
      'evals/greets.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { plain, withSkill } from './envs.ts'
export default defineEval({
  runs: 1, compare: { control: plain, variants: [withSkill] },
  async task(c) {

  const turn = await c.send('greet')
  const loaded = turn.trajectory.some((e) => e.type === 'text' && e.text === 'Loaded skills: house-greeting; mcp: docs')
  const token = (await c.exec('printf %s "$APP_TOKEN"')).stdout
  assert.equal(token, 's3cret-value-123')
  assert.equal((await c.exec('printf %s "$MODE"')).stdout, 'test')
  if (c.attempt.cell.role === 'control') {
    assert.equal(loaded, false)
    assert.equal(await c.readFile('AGENTS.md'), null)
    throw new Error('the control never knows the house style')
  }
  assert.equal(loaded, true)
  assert.equal(await c.readFile('AGENTS.md'), 'Always write tests.')
  assert.equal(await c.readFile('notes/readme.txt'), 'hello')
  assert.equal(await c.readFile('docs/api.md'), '# API\\n')
  assert.equal((await c.readFile('secret-length.txt'))?.trim(), '32')
  assert.equal((await c.exec('printf %s "$FLAVOR"')).stdout, 'mint')
  assert.equal((await c.exec('printf %s "$CHECK_TOKEN"')).stdout, 's3cret-value-123')
  assert.ok(!(turn.diff.files.map((f) => f.path)).includes('AGENTS.md'))

  },
})
`,
    })
    const r = await runCli(p.dir, ['run', '--output-logs', 'full'], {
      env: { REEVAL_TEST_HOST_TOKEN: 's3cret-value-123' },
    })
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /^\[greets#1 with-skill\] ▶ greets/m)
    assert.match(r.stdout, /^[│ ]+with-skill +1 of 1 {2}helped$/m)
    const { run, evals, dir } = readRun(p.dir)
    const envs = Object.fromEntries(run.environments.map((e) => [e.name, e]))
    assert.deepEqual(Object.keys(envs).sort(), ['plain', 'with-skill'])
    const w = envs['with-skill']
    assert.deepEqual(
      w?.skills.map((s) => [s.name, s.source, s.commit]),
      [['house-greeting', 'local:skills', null]],
    )
    assert.deepEqual(w?.mcp, ['docs'])
    assert.deepEqual(w?.secrets, ['APP_TOKEN', 'CHECK_TOKEN', 'EXTRA_TOKEN'])
    assert.deepEqual(w?.unset, ['MAYBE_TOKEN'])
    assert.deepEqual(w?.vars, ['FLAVOR', 'MODE'])
    assert.equal('image' in (w ?? {}), false, 'environments record no image steps')
    assert.equal(w?.setup.length, 1)
    const [e] = evals
    const variant = e?.attempts.find((a) => a.cell === 'fake/with-skill/fake')
    assert.deepEqual(variant?.env, {
      vars: ['FLAVOR', 'MODE'],
      secrets: ['APP_TOKEN', 'CHECK_TOKEN', 'EXTRA_TOKEN'],
      brokered: [],
    })
    assert.ok(variant?.files.setupLog, 'setup steps write setup.log')
    assert.match(readRun(p.dir).read(variant?.files.setupLog?.path ?? ''), /exit 0 after \d+m?s/)
    assert.notEqual(e?.cells[0]?.fingerprint, e?.cells[1]?.fingerprint)
    let leaks = ''
    try {
      leaks = execFileSync('grep', ['-r', '-l', 's3cret-value-123', dir], { encoding: 'utf8' })
    } catch {}
    assert.equal(leaks, '', 'the secret value is redacted everywhere')
  })

  test('a missing secret is an infra error; a failing setup step names itself', async () => {
    const p = await project('missing-secret', {
      'reeval.config.ts': fakeConfig(),
      'evals/needs-it.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
const needs = defineEnvironment('needs', ({ secret }) => ({
  sandbox: fakeSandbox(),
  env: { NEEDED: secret.fromEnv('REEVAL_TEST_NOT_SET') },
}))
export default defineEval({
  environment: needs,
  async task(c) { await c.send('x') },
})
`,
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 3, r.stdout + r.stderr)
    assert.match(
      r.stdout,
      /Secret NEEDED \(from REEVAL_TEST_NOT_SET\) for environment needs .* isn't set\. Set it in the environment or \.env\.local\./,
    )

    const failing = await project('setup-fails', {
      'reeval.config.ts': fakeConfig(),
      'evals/x.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
const broken = defineEnvironment('broken', {
  sandbox: fakeSandbox(),
  setup: [{ run: 'true' }, { run: 'echo nope >&2; exit 4' }],
})
export default defineEval({ environment: broken, timeout: '1s', async task(c) { await c.send('x') } })
`,
    })
    const f = await runCli(failing.dir)
    assert.equal(f.code, 3, f.stdout + f.stderr)
    assert.match(
      f.stdout,
      /setup step 2\/2 "echo nope >&2; exit 4" in environment broken exited 4 after \d+m?s \(see setup\.log\):\s.*nope/,
    )
  })

  test('skills come from a git URL at a ref, with the commit recorded; workspace placement', async () => {
    const p = await project('git-skill', { 'reeval.config.ts': fakeConfig() })
    const repo = join(p.dir, 'skill-repo')
    mkdirSync(join(repo, 'skills/house-greeting'), { recursive: true })
    writeFileSync(join(repo, 'skills/house-greeting/SKILL.md'), SKILL)
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
        cwd: repo,
        encoding: 'utf8',
      }).trim()
    git('init', '-q', '-b', 'main')
    git('add', '-A')
    git('commit', '-q', '-m', 'skill')
    git('tag', 'v1')
    const sha = git('rev-parse', 'HEAD')
    mkdirSync(join(p.dir, 'evals'))
    writeFileSync(
      join(p.dir, 'evals/loads-it.eval.ts'),
      `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
const env = defineEnvironment('remote', ({ skill }) => ({
  sandbox: fakeSandbox(),
  skills: [
    skill.git('${pathToFileURL(repo).href}', { ref: 'v1', path: 'skills', only: ['house-greeting'] }),
    skill.inline({ name: 'house-rules', description: 'Rules.', content: 'Be nice.' }, { placement: 'workspace' }),
  ],
}))
export default defineEval({
  environment: env,
  async task(c) {
    const turn = await c.send('x')
    assert.equal(turn.trajectory.some((e) => e.type === 'text' && e.text === 'Loaded skills: house-greeting, house-rules'), true)
    assert.ok((await c.readFile('.agents/skills/house-rules/SKILL.md')).includes('Be nice.'))
    assert.deepEqual(turn.diff.files, [])
  },
})
`,
    )
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const skills = readRun(p.dir).run.environments[0]?.skills
    assert.equal(skills?.[0]?.commit, sha)
    assert.equal(skills?.[0]?.source, `${pathToFileURL(repo).href}#v1:skills`)
    assert.deepEqual(
      skills?.map((s) => [s.name, s.placement]),
      [
        ['house-greeting', 'harness'],
        ['house-rules', 'workspace'],
      ],
    )
  })

  test("a local skill's evals/ and *.eval.ts stay out of the sandbox; a block description parses", async () => {
    const p = await project('skill-hygiene', {
      'reeval.config.ts': fakeConfig(),
      'evals/staged.eval.ts': `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
const env = defineEnvironment('reviewer', ({ skill }) => ({
  sandbox: fakeSandbox(),
  skills: [skill.local('../skills/skill-reviewer', { placement: 'workspace' })],
}))
export default defineEval({
  environment: env,
  async task(c) {
    await c.send('x')
    const md = await c.readFile('.agents/skills/skill-reviewer/SKILL.md')
    assert.ok(md.includes(${JSON.stringify(`description: ${JSON.stringify(REVIEWER_DESCRIPTION)}`)}))
    assert.ok(md.includes('# Skill reviewer'))
    assert.ok((await c.readFile('.agents/skills/skill-reviewer/docs/checklist.md')).includes('# Checklist'))
    const listed = (await c.exec('cd .agents/skills/skill-reviewer && find . -type f | LC_ALL=C sort')).stdout
    assert.deepEqual(listed.trim().split('\\n'), ['./SKILL.md', './docs/checklist.md'])
  },
})
`,
    })
    cpSync(
      new URL('./fixtures/skill-reviewer', import.meta.url),
      join(p.dir, 'skills/skill-reviewer'),
      {
        recursive: true,
      },
    )
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const [s] = readRun(p.dir).run.environments[0]?.skills ?? []
    assert.deepEqual([s?.name, s?.excluded], ['skill-reviewer', ['evals/', 'review.eval.ts']])
  })
})

describe('sandbox images', () => {
  const sandboxCases: Array<[string, string, RegExp]> = [
    [
      'two bases',
      `docker({ image: 'x:1', dockerfile: './Dockerfile' })`,
      /docker\(\) takes one base image, but got image and dockerfile\. Use image \(has the harness\), from \(a toolchain image reeval bakes the harness onto\) or dockerfile\./,
    ],
    [
      'image and from',
      `docker({ image: 'x:1', from: 'python:3.12-slim' })`,
      /docker\(\) takes one base image, but got image and from\./,
    ],
    [
      'install with a dockerfile',
      `docker({ dockerfile: './Dockerfile', install: ['apt-get install -y jq'] })`,
      /docker\(\) takes dockerfile or install, not both: put the install commands in the Dockerfile as RUN lines/,
    ],
    [
      'a missing dockerfile',
      `docker({ dockerfile: './nope/Dockerfile' })`,
      /docker\(\{ dockerfile: "\.\/nope\/Dockerfile" \}\): .+[/\\]evals[/\\]nope[/\\]Dockerfile doesn't exist\. Paths are relative to the file that calls docker\(\)\./,
    ],
    [
      'an empty install',
      `docker({ install: [] })`,
      /docker\(\{ install \}\) takes a non-empty list of shell commands/,
    ],
    [
      'an install command that is not a command',
      `docker({ install: [{ command: 'x' }] as never })`,
      /docker\(\{ install \}\) commands are strings or \{ run, timeout\? \} objects \(got \{"command":"x"\}\)/,
    ],
    [
      'a bad install timeout',
      `docker({ install: [{ run: 'x', timeout: 'soon' }] as never })`,
      /docker\(\{ install \}\) command "x": Invalid duration "soon"\. Use e\.g\. "90s" or "15m"\./,
    ],
    [
      'steps instead of install',
      `docker({ steps: ['x'] } as never)`,
      /Unknown docker\(\) option "steps"\. Did you mean "install"\?/,
    ],
    [
      'user instead of root',
      `docker({ user: 'root' } as never)`,
      /Unknown docker\(\) option "user"\. Did you mean "root"\?/,
    ],
    [
      'root that is not a boolean',
      `docker({ root: 'yes' } as never)`,
      /docker\(\{ root \}\) is true or false \(got "yes"\)/,
    ],
    [
      'a capability that is not a name',
      `docker({ capabilities: 'NET_RAW' } as never)`,
      /docker\(\{ capabilities \}\) takes Linux capability names, e\.g\. capabilities: \['NET_RAW'\] \(got "NET_RAW"\)/,
    ],
    [
      'a memory size docker does not take',
      `docker({ memory: '4GB' })`,
      /docker\(\{ memory \}\) takes a size such as '4g' or '512m', or bytes \(got "4GB"\)/,
    ],
    [
      'memorySwap instead of swap',
      `docker({ memorySwap: '8g' } as never)`,
      /Unknown docker\(\) option "memorySwap"\. Did you mean "swap"\?/,
    ],
    [
      'memswap instead of swap',
      `docker({ memswap: '8g' } as never)`,
      /Unknown docker\(\) option "memswap"\. Did you mean "swap"\?/,
    ],
    [
      'a negative swap',
      `docker({ swap: -1 })`,
      /docker\(\{ swap \}\) takes a size such as '2g' or '512m', bytes, or 0 for none \(got -1\)/,
    ],
    [
      'zero CPUs',
      `docker({ cpus: 0 })`,
      /docker\(\{ cpus \}\) takes a number of CPUs above zero, e\.g\. 1\.5 \(got 0\)/,
    ],
    [
      'a fractional process limit',
      `docker({ pids: 10.5 })`,
      /docker\(\{ pids \}\) takes a whole number of processes above zero \(got 10\.5\)/,
    ],
    [
      'secrets on the sandbox',
      `docker({ env: {} } as never)`,
      /Unknown docker\(\) option "env"\. The sandbox is what's baked into the image; variables and secrets belong in defineEnvironment\(\{ env \}\)\./,
    ],
  ]
  for (const [what, sandbox, message] of sandboxCases) {
    test(`${what} exits 2 with a fix`, async () => {
      const p = await project('sandbox-mistake', {
        'reeval.config.ts': fakeConfig(),
        'evals/Dockerfile': 'FROM debian:bookworm-slim\n',
        'evals/e.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'
const env = defineEnvironment('e', { sandbox: ${sandbox} })
export default defineEval({
  environment: env,
  async task() {},
})
`,
      })
      const r = await runCli(p.dir, ['run', '--dry-run'])
      assert.equal(r.code, 2, `${sandbox}\n${r.stdout}${r.stderr}`)
      assert.match(r.stderr, message)
    })
  }

  test('reeval image build --dry-run lists every image the planned sandboxes need', async () => {
    const p = await project('image-plan', {
      'reeval.config.ts': `
import { defineConfig, defineEnvironment } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { docker } from 'reeval/sandbox'
import { fakeJudge } from 'reeval/judge'
const tools = defineEnvironment('tools', {
  sandbox: docker({ install: ['apt-get update && apt-get install -y jq', { run: 'jq --version', timeout: '1m' }] }),
})
export default defineConfig({
  agents: fakeAgent({}),
  environments: tools,
  judge: { model: fakeJudge() },
})
`,
      'docker/tools/Dockerfile': `ARG REEVAL_BASE\nFROM \${REEVAL_BASE}\nRUN echo tools\n`,
      'evals/py.Dockerfile': 'FROM python:3.12-slim\n',
      'evals/default.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'
const py = defineEnvironment('py', { sandbox: docker({ dockerfile: 'py.Dockerfile' }) })
export default defineEval({
  environment: py,
  async task() {},
})
`,
      'evals/from-slim.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'
const slim = defineEnvironment('slim', { sandbox: docker({ from: 'python:3.12-slim' }) })
export default defineEval({
  environment: slim,
  async task() {},
})
`,
      'evals/uses-tools.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ async task() {} })
`,
    })
    const r = await runCli(p.dir, ['image', 'build', '--dry-run'])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const out = r.stdout
    assert.match(out, /^images {2}3 sandbox images \(nothing built: --dry-run\)$/m)
    // Each step's standing depends on what this machine has built, so only its shape is checked.
    const st = '[✓+~✗?] '
    assert.match(
      out,
      new RegExp(
        `^docker\\+[0-9a-f]+ · cursor \\+ install · \\d+ evals?\\n {2}${st}base +reeval-sandbox:cursor-[\\d.]+ +\\((ready|to build|stale|unchecked): .+\\)\\n {2}${st}install 2 commands +reeval-install:[0-9a-f]{16} +\\(`,
        'm',
      ),
    )
    assert.match(
      out,
      new RegExp(
        `^docker:py\\.Dockerfile · cursor · 1 eval\\n {2}${st}dockerfile evals/py\\.Dockerfile +reeval-dockerfile:py-dockerfile-[0-9a-f]{16} .*\\n {2}${st}harness +reeval-sandbox:cursor-[\\d.]+-reeval-dockerfile-py-dockerfile-`,
        'm',
      ),
    )
    assert.match(
      out,
      new RegExp(
        `^docker:python:3\\.12-slim · cursor · 1 eval\\n {2}${st}from python:3\\.12-slim +reeval-sandbox:cursor-[\\d.]+-python-3-12-slim-[0-9a-f]{8}`,
        'm',
      ),
    )
    assert.doesNotMatch(out, /fake/)
    const runs = join(p.dir, '.reeval', 'runs')
    assert.equal(existsSync(runs) ? readdirSync(runs).length : 0, 0, 'a dry run writes no run')
  })

  test('reeval image build --profile plans the images with the profile, as reeval run does', async () => {
    const p = await project('image-profile', {
      'reeval.config.ts': `
import { defineConfig } from 'reeval'
import { claudeCode, fakeAgent } from 'reeval/agent'
import { docker } from 'reeval/sandbox'
import { fakeJudge } from 'reeval/judge'
export default defineConfig({
  agents: fakeAgent({}),
  judge: { model: fakeJudge() },
  profiles: {
    claude: { defaults: { agents: claudeCode({ model: 'claude-sonnet-5' }) } },
    tools: { tags: ['tools'] },
  },
})
`,
      'docker/tools/Dockerfile': `ARG REEVAL_BASE\nFROM \${REEVAL_BASE}\nRUN echo tools\n`,
      'evals/plain.eval.ts': `import { defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'
export default defineEval({
  sandbox: docker(),
  async task() {},
})
`,
      'evals/tools.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'
const tools = defineEnvironment('tools', {
  sandbox: docker({ dockerfile: '../docker/tools/Dockerfile' }),
})
export default defineEval({
  tags: ['tools'],
  environment: tools,
  async task() {},
})
`,
    })
    const cursor = /^ {2}[✓+~✗?] base +reeval-sandbox:cursor-[\d.]+ /m
    const claude = /^ {2}[✓+~✗?] base +reeval-sandbox:claude-code-[\w.-]+ /m
    const tools = /^docker:tools · [\w-]+ · 1 eval$/m
    const dry = async (args: string[], env?: Record<string, string>) => {
      const r = await runCli(p.dir, ['image', 'build', '--dry-run', ...args], env ? { env } : {})
      assert.equal(r.code, 0, `${args.join(' ')}\n${r.stdout}${r.stderr}`)
      return r.stdout
    }

    const none = await dry([])
    assert.match(none, cursor)
    assert.doesNotMatch(none, claude)
    assert.match(none, tools)
    // The profile's harness picks its image.
    const onClaude = await dry(['--profile', 'claude'])
    assert.match(onClaude, claude)
    assert.doesNotMatch(onClaude, cursor)
    // Its tags narrow the evals, so the plain eval's image drops out.
    const tagged = await dry(['--profile', 'tools'])
    assert.match(tagged, /^images {2}1 sandbox image /m)
    assert.match(tagged, tools)
    assert.doesNotMatch(tagged, /^docker · /m)
    // REEVAL_PROFILE works too, and the flag wins over it.
    assert.match(await dry([], { REEVAL_PROFILE: 'claude' }), claude)
    assert.match(await dry(['--profile', 'claude'], { REEVAL_PROFILE: 'tools' }), claude)

    const unknown = await runCli(p.dir, ['image', 'build', '--dry-run', '--profile', 'nope'])
    assert.equal(unknown.code, 2, unknown.stdout + unknown.stderr)
    assert.match(
      unknown.stderr,
      /^reeval: Unknown profile "nope"\. Profiles in reeval\.config\.ts: claude, tools\.\n$/,
    )
    // A missing config is refused before a profile is named.
    const bare = await project('image-profile-bare', {})
    const noConfig = await runCli(bare.dir, ['image', 'build', '--dry-run', '--profile', 'x'])
    assert.equal(noConfig.code, 2, noConfig.stdout + noConfig.stderr)
    assert.match(
      noConfig.stderr,
      /^reeval: No reeval\.config\.ts \(or reeval\.config\.mts, reeval\.config\.cts, reeval\.config\.js, reeval\.config\.mjs, reeval\.config\.cjs, reeval\.yaml, reeval\.yml\) here or above\. Run reeval init\.\n$/,
    )
  })
})

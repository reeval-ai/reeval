// `c.observe(name, value)`: the values it keeps, what it refuses, and how they're tallied and
// queried. The fixture `history/observe` checks the same from inside a trial.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { validate } from '../scripts/schema/validate.ts'
import { trialInput } from '../src/compare/questions.ts'
import { resolveQuestionState } from '../src/compare/state.ts'
import type { FileRef, TrialRecord } from '../src/history/types.ts'
import { sha256 } from '../src/ids.ts'
import { observedFileBytes, observer } from '../src/trial/observe.ts'
import type { Trial } from '../src/trial/state.ts'
import type { EvalRecord } from '../src/types.ts'
import { observedLine, observedTallies } from '../src/view/observations.ts'
import { fakeConfig, project, readRun, runCli } from './helpers.ts'

function trial(ended = false, signal = new AbortController().signal) {
  const a = { record: {} as EvalRecord, turns: [] as unknown[], ended, signal }
  return { a, observe: observer(a as unknown as Trial) }
}

describe('c.observe', () => {
  test('keeps the last value per name, in first-call order, with its turn', () => {
    const { a, observe } = trial()
    observe('orm', 'none')
    a.turns.push({})
    observe('deps', ['pg'])
    observe('orm', 'drizzle')
    assert.deepEqual(a.record.observations, [
      { name: 'orm', value: 'drizzle', turn: 1 },
      { name: 'deps', value: ['pg'], turn: 1 },
    ])
  })

  test('keeps a large value whole, masked, and counts it toward the trial', () => {
    const { a, observe } = trial()
    const big = { log: 'x'.repeat(1_000_000), token: `ghp_${'a'.repeat(36)}` }
    observe('big', big)
    const [kept] = a.record.observations ?? []
    assert.deepEqual(kept?.value, { log: big.log, token: '[REDACTED]' })
    assert.equal(observedFileBytes(a as unknown as Trial), JSON.stringify(kept?.value).length)
    observe('small', 1)
    observe('big', 'short now')
    assert.equal(observedFileBytes(a as unknown as Trial), 0, 'only the last value per name counts')
  })

  test("refuses large values past the trial's 100 MiB", () => {
    const { a, observe } = trial()
    const half = 'x'.repeat(51 * 2 ** 20)
    observe('one', half)
    assert.throws(
      () => observe('two', half),
      /c\.observe\("two"\) would keep 102\.0 MB of large observed values, over the trial's 100\.0 MB: observe less, or a summary of it/,
    )
    assert.deepEqual(
      a.record.observations?.map((o) => o.name),
      ['one'],
    )
  })

  test('masks a secret-looking value', () => {
    const { a, observe } = trial()
    observe('env', { token: `ghp_${'a'.repeat(36)}` })
    assert.deepEqual(a.record.observations?.[0]?.value, { token: '[REDACTED]' })
  })

  test('masks a secret-looking name, and refuses another that masks to the same name', () => {
    const token = (c: string) => `ghp_${c.repeat(36)}`
    const { a, observe } = trial()
    observe(token('a'), 1)
    observe(token('a'), 2)
    observe(`count_${token('b')}`, 3)
    assert.throws(
      () => observe(token('c'), 4),
      (e: Error) =>
        /c\.observe\("\[REDACTED\]"\) names a secret, and its masked name is another observation's/.test(
          e.message,
        ) && !e.message.includes('ghp_'),
    )
    assert.deepEqual(
      a.record.observations?.map(({ sha256: _, ...o }) => o),
      [
        { name: '[REDACTED]', value: 2, turn: 0 },
        { name: 'count_[REDACTED]', value: 3, turn: 0 },
      ],
    )
  })

  test('masks a number that is a secret', () => {
    process.env.REEVAL_T_SECRET_PIN = '98765432'
    try {
      const { a, observe } = trial()
      observe('pin', { pin: 98765432, n: 3 })
      assert.deepEqual(a.record.observations?.[0]?.value, { pin: '[REDACTED]', n: 3 })
    } finally {
      delete process.env.REEVAL_T_SECRET_PIN
    }
  })

  test('refuses what it cannot record, naming why', () => {
    const { observe } = trial()
    const refused: Array<[string, unknown, RegExp]> = [
      ['has space', 1, /needs a name of 1 to 64 letters/],
      ['n', Number.NaN, /takes JSON: NaN isn't a finite number/],
      ['n', { a: [1, undefined] }, /takes JSON: a undefined at a\[1\] isn't JSON/],
      ['n', new Date(0), /takes JSON: a Date isn't plain JSON/],
    ]
    for (const [name, value, message] of refused) {
      assert.throws(() => observe(name, value as never), message)
    }
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    assert.throws(() => observe('n', cyclic as never), /refers to itself at self/)
    // biome-ignore lint/suspicious/noSparseArray: a hole is what's refused
    assert.throws(() => observe('n', [, 1] as never), /a undefined at \[0\] isn't JSON/)
    let deep: unknown = 1
    for (let i = 0; i < 100_000; i++) deep = [deep]
    assert.throws(() => observe('n', deep as never), /takes JSON: it nests deeper than 64 levels/)
  })

  test('refuses a call once the trial timed out or was canceled', () => {
    const { a, observe } = trial(false, AbortSignal.abort())
    assert.throws(() => observe('late', 1), /came after the trial timed out or was canceled/)
    assert.equal(a.record.observations, undefined)
  })

  test('caps the names a trial observes, and refuses a call after the body', () => {
    const { observe } = trial()
    for (let i = 0; i < 50; i++) observe(`n${i}`, i)
    observe('n0', 'again')
    assert.throws(() => observe('n50', 1), /one name too many: a trial observes at most 50/)
    assert.throws(() => trial(true).observe('late', 1), /came after the eval's body returned/)
  })
})

describe('observed tallies', () => {
  const at = (cell: string, observations: Array<[string, unknown]>) => ({
    cell,
    observations: observations.map(([name, value]) => ({ name, value: value as never, turn: 1 })),
  })

  test('tally per name and cell: scalars, array items once each, numbers summarized', () => {
    const tallies = observedTallies([
      at('a', [
        ['orm', 'drizzle'],
        ['deps', ['pg', 'pg', 'drizzle-orm']],
        ['n', 4],
      ]),
      at('a', [
        ['orm', 'prisma'],
        ['n', 10],
        ['cfg', { strict: true }],
      ]),
      at('a', [
        ['orm', 'drizzle'],
        ['n', 1],
      ]),
      at('b', [['orm', 'prisma']]),
    ])
    assert.deepEqual(
      tallies.map((t) => [t.name, t.cell, observedLine(t)]),
      [
        ['orm', 'a', 'drizzle 2 · prisma 1'],
        ['orm', 'b', 'prisma 1'],
        ['deps', 'a', 'pg 1 · drizzle-orm 1 · 1 trial'],
        ['n', 'a', 'median 4 · range 1–10 · 3 trials'],
        ['cfg', 'a', '1 value in reeval query trial_values · 1 trial'],
      ],
    )
  })

  test('counts a value kept in a file with the untallied ones, not as null', () => {
    const file = { path: 'evals/a/observations/1.json', sha256: 'x', bytes: 5000 }
    const tallies = observedTallies([
      { cell: 'a', observations: [{ name: 'log', value: null, file, turn: 1 }] },
      { cell: 'a', observations: [{ name: 'log', value: 'short', turn: 1 }] },
    ])
    assert.deepEqual(
      tallies.map((t) => [t.counts, t.others, observedLine(t)]),
      [
        [
          [{ value: 'short', n: 1 }],
          1,
          'short 1 · 1 value in reeval query trial_values · 2 trials',
        ],
      ],
    )
  })

  test('shows a value on one line', () => {
    const [t] = observedTallies([at('a', [['v', 'one\ntwo \u001b[31mred\u0007']])])
    assert.equal(t && observedLine(t), 'one two [31mred 1')
  })

  test('shows the top five, then how many more', () => {
    const [t] = observedTallies(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((v) => at('a', [['pick', v]])),
    )
    assert.equal(t && observedLine(t), 'a 1 · b 1 · c 1 · d 1 · e 1 · +2 more')
  })
})

describe('observations in a run', () => {
  test('recorded per trial, tallied in the output and queryable, and never gating', async () => {
    const p = await project('observe-run', {
      'reeval.config.ts': fakeConfig(),
      'evals/a.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  trials: 2,
  async task(c) {
    await c.send('x')
    c.observe('orm', c.trial.n === 1 ? 'drizzle' : 'prisma')
    c.observe('files', c.trial.n)
    assert.equal(c.trial.n, 1, 'first run only')
  },
})
`,
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 1, r.stdout + r.stderr)
    assert.match(
      r.stdout,
      /Observed:\n +orm +drizzle 1 · prisma 1\n +files +median 1\.5 · range 1–2 · 2 trials$/m,
    )
    const { run } = readRun(p.dir)
    const trials = run.evals[0]?.trials ?? []
    assert.deepEqual(
      trials.map((a) => [a.outcome, a.observations?.map((o) => o.value)]),
      [
        ['pass', ['drizzle', 1]],
        ['fail', ['prisma', 2]],
      ],
    )
    const q = await runCli(p.dir, [
      'query',
      'SELECT trial_id, outcome, name, kind, num, text, agent FROM trial_values ORDER BY trial_id, name',
      '--json',
    ])
    assert.equal(q.code, 0, q.stderr)
    assert.deepEqual(JSON.parse(q.stdout), [
      {
        trial_id: 'fake/fake/fake#1',
        outcome: 'pass',
        name: 'files',
        kind: 'number',
        num: 1,
        text: null,
        agent: 'fake',
      },
      {
        trial_id: 'fake/fake/fake#1',
        outcome: 'pass',
        name: 'orm',
        kind: 'string',
        num: null,
        text: 'drizzle',
        agent: 'fake',
      },
      {
        trial_id: 'fake/fake/fake#2',
        outcome: 'fail',
        name: 'files',
        kind: 'number',
        num: 2,
        text: null,
        agent: 'fake',
      },
      {
        trial_id: 'fake/fake/fake#2',
        outcome: 'fail',
        name: 'orm',
        kind: 'string',
        num: null,
        text: 'prisma',
        agent: 'fake',
      },
    ])
  })
})

describe('observations as judge and question input', () => {
  test('judges and questions see them only when they turn them on', async () => {
    const p = await project('observe-input', {
      'reeval.config.ts': `import { defineConfig, defineEnvironment } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeAnalysis } from 'reeval/judge'
import { fakeSandbox } from 'reeval/sandbox'
export default defineConfig({
  agents: fakeAgent(),
  environments: defineEnvironment('fake', { sandbox: fakeSandbox() }),
  analysis: { model: fakeAnalysis({ answer: (q) => JSON.stringify(q.trial.observations ?? null) }) },
})
`,
      'evals/a.eval.ts': `import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
const seen = (state) => (state.observations?.orm === 'drizzle' ? 0.9 : 0.1)
const questions = [
  { question: 'Which ORM?', observations: ['orm'] },
  { question: 'What did it say?', output: true },
  { question: 'All of them?', observations: true },
]
export default defineEval({
  questions, judge: { model: fakeJudge({ score: seen }) },
  graders: [
    judge('picked drizzle?', { inputs: { observations: ['orm'] } }),
    judge('saw it without asking?', { inputs: { output: true }, weight: 0 }),
  ],
  async task(c) {
    await c.send('x')
    c.observe('orm', 'drizzle')
    c.observe('lines', 3)
  },
})
`,
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const { run } = readRun(p.dir)
    const schema = JSON.parse(
      readFileSync(new URL('../schema/run-record.schema.json', import.meta.url), 'utf8'),
    )
    assert.deepEqual(validate(schema, run), [])
    const trial = run.evals[0]?.trials[0]
    assert.deepEqual(
      trial?.grades?.map((g) => [g.grader, (g.score ?? 0) >= 0.5]),
      [
        ['judge:picked drizzle?', true],
        ['judge:saw it without asking?', false],
      ],
    )
    assert.deepEqual(
      trial?.answers?.map((a) => [a.question, a.text]),
      [
        ['Which ORM?', JSON.stringify([{ name: 'orm', value: 'drizzle' }])],
        ['What did it say?', 'null'],
        [
          'All of them?',
          JSON.stringify([
            { name: 'orm', value: 'drizzle' },
            { name: 'lines', value: 3 },
          ]),
        ],
      ],
    )
  })
})

describe('a large observation in a run', () => {
  let ran: Promise<{ dir: string; trial: TrialRecord; file: FileRef }> | undefined
  const large = () =>
    (ran ??= (async () => {
      const p = await project('observe-large', {
        'reeval.config.ts': `import { defineConfig, defineEnvironment } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeAnalysis } from 'reeval/judge'
import { fakeSandbox } from 'reeval/sandbox'
export default defineConfig({
  agents: fakeAgent(),
  environments: defineEnvironment('fake', { sandbox: fakeSandbox() }),
  analysis: { model: fakeAnalysis({ answer: (q) => JSON.stringify(q.trial.observations ?? null) }) },
})
`,
        'evals/a.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  questions: [{ question: 'What did it log?', observations: ['log'] }],
  async task(c) {
    await c.send('x')
    c.observe('log', 'line\\n'.repeat(1200))
  },
})
`,
      })
      const r = await runCli(p.dir)
      assert.equal(r.code, 0, r.stdout + r.stderr)
      const trial = readRun(p.dir).run.evals[0]?.trials[0]
      const file = trial?.observations?.[0]?.file
      assert.ok(trial && file, 'kept in a file')
      return { dir: p.dir, trial, file }
    })())

  test('a question reads it whole', async () => {
    const { trial } = await large()
    // The recorded answer is capped; its start shows the question had the value, not null.
    const text = trial.answers?.[0]?.text ?? ''
    const shown = JSON.stringify([{ name: 'log', value: 'line\n'.repeat(1200) }])
    assert.ok(text.length > 100 && shown.startsWith(text.replace(/…$/, '')), text.slice(0, 60))
  })

  test('trial_values names its file, with no value', async () => {
    const { dir, file } = await large()
    const q = await runCli(dir, [
      'query',
      'SELECT name, value, kind, text, file_path FROM trial_values',
      '--json',
    ])
    assert.equal(q.code, 0, q.stderr)
    assert.deepEqual(JSON.parse(q.stdout), [
      { name: 'log', value: null, kind: 'file', text: null, file_path: file.path },
    ])
  })
})

describe('a secret-looking observation name in a run', () => {
  test('is masked in the record, the judge state and the question, and a judge or question names it as observed', async () => {
    const token = `ghp_${'q'.repeat(36)}`
    const p = await project('observe-secret-name', {
      'reeval.config.ts': `import { defineConfig, defineEnvironment } from 'reeval'
  import { fakeAgent } from 'reeval/agent'
  import { fakeAnalysis } from 'reeval/judge'
  import { fakeSandbox } from 'reeval/sandbox'
  export default defineConfig({
    agents: fakeAgent(),
    environments: defineEnvironment('fake', { sandbox: fakeSandbox() }),
    analysis: { model: fakeAnalysis({ answer: (q) => JSON.stringify(q.trial.observations ?? null) }) },
  })
  `,
      'evals/masked.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
  import { fakeJudge } from 'reeval/judge'
  const token = 'ghp_' + 'q'.repeat(36)
  const other = 'ghp_' + 'z'.repeat(36)
  const seen = (state) => (state.observations?.['[REDACTED]'] === 'kept' ? 0.9 : 0.1)
  const questions = [{ question: 'Kept?', observations: [token] }]
  export default defineEval({
    questions,
    judge: { model: fakeJudge({ score: seen }) },
    graders: [judge('kept?', { inputs: { observations: [token] } })],
    async task(c) {
      await c.send('x')
      c.observe(token, 'kept')
      assert.throws(() => c.observe(other, 'lost'), /names a secret/)
    },
  })
`,
    })
    const r = await runCli(p.dir)
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const { run } = readRun(p.dir)
    const trial = run.evals[0]?.trials[0]
    assert.deepEqual(trial?.observations, [
      { name: '[REDACTED]', value: 'kept', turn: 1, sha256: sha256('"kept"') },
    ])
    assert.deepEqual(trial?.answers?.[0]?.stateOptions.observations, ['[REDACTED]'])
    assert.equal(trial?.answers?.[0]?.text, JSON.stringify([{ name: '[REDACTED]', value: 'kept' }]))
    const record = JSON.stringify(run)
    assert.ok(!record.includes(token) && !record.includes('z'.repeat(36)), record)
  })
})

describe('observations in a question cut to fit', () => {
  test('a long diff is cut before them', () => {
    const trial = {
      harness: 'fake',
      environment: 'base',
      run: 1,
      diff: `diff --git a/a.ts b/a.ts\n${'+x\n'.repeat(5000)}`,
      checksPassed: true,
      observations: [{ name: 'orm', value: 'drizzle', turn: 1 }],
      id: 'fake#1',
    }
    const state = resolveQuestionState({ diff: true, observations: ['orm'] })
    const { blind } = trialInput('Which ORM?', trial, 1000, { state })
    assert.match(blind.prompt, /<observations>\norm = "drizzle"\n<\/observations>/)
    assert.match(blind.prompt, /\[reeval: trial cut at 4000 of \d+ characters\]/)
  })
})

describe('observations in reeval compare', () => {
  test('a moved tally shows on an eval that is otherwise the same', async () => {
    const p = await project('observe-compare', {
      'reeval.config.ts': fakeConfig(),
      'evals/a.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  trials: 2,
  async task(c) {
    await c.send('x')
    c.observe('orm', c.trial.n === 1 ? 'drizzle' : (process.env.SECOND_ORM ?? 'drizzle'))
    c.observe('steady', 1)
  },
})
`,
    })
    assert.equal((await runCli(p.dir)).code, 0)
    assert.equal((await runCli(p.dir, ['run'], { env: { SECOND_ORM: 'prisma' } })).code, 0)
    const base = readRun(p.dir, { back: 1 }).run.runId
    const head = readRun(p.dir).run.runId
    const r = await runCli(p.dir, ['compare', base, head])
    assert.equal(r.code, 0, r.stderr)
    assert.match(r.stdout, /same +a\n +observed orm +drizzle 2 → 1 · prisma 0 → 1\n/)
    assert.doesNotMatch(r.stdout, /observed steady/)
  })
})

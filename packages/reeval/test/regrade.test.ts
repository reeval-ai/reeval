// `reeval regrade`: recorded runs graded again after their graders change, the plan it prints, the
// regrade files it writes beside each run, and the readers that apply them.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import type { RegradeRecord } from '../src/history/types.ts'
import { baseEnv, fakeConfig, project, runCli } from './helpers.ts'

const GIT_ENV = {
  ...baseEnv,
  GIT_AUTHOR_NAME: 'Test Author',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test Author',
  GIT_COMMITTER_EMAIL: 'test@example.com',
}
const sh = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' }).trim()

const HISTORY = 'evals/.history'
const harness = "{ script: [[{ write: { 'out.txt': 'hello' } }, { reply: 'Wrote out.txt' }]] }"

const graders = (word = 'hello', required = false) => `import { defineGrader } from 'reeval'
export const says = defineGrader('says', {
  files: ['out.txt'],
  required: ${required},
  grade: async (c) => (await c.readFile('out.txt')) === '${word}',
})
export const key = defineGrader('key', { grade: (c) => c.case.key, weight: 0 })
export const quality = defineGrader('quality', {
  judge: { question: 'Is the reply clear?', inputs: { output: true } },
})
`
const evalFile = (list = 'says, key') => `import { defineEval } from 'reeval'
import { inDiff } from 'reeval/graders'
import { key, quality, says } from './graders.ts'
export default defineEval({ graders: [${list}], task: async (c) => void (await c.send('write it')) })
`

/** A committed project with one recorded run of `evals/one.eval.ts`. */
async function recorded(
  name: string,
  options: { artifacts?: string; judge?: string; list?: string } = {},
) {
  const p = await project(name, {
    '.gitignore': '.reeval/\nnode_modules/\nsandboxes/\n',
    'reeval.config.ts': fakeConfig({
      harness,
      ...(options.judge ? { judge: options.judge } : {}),
      ...(options.artifacts ? { extra: `history: { artifacts: '${options.artifacts}' },` } : {}),
    }),
    'evals/graders.ts': graders(),
    'evals/one.eval.ts': evalFile(options.list),
  })
  sh(p.dir, 'init', '-q', '-b', 'main')
  sh(p.dir, 'add', '-A')
  sh(p.dir, 'commit', '-q', '-m', 'init')
  const r = await runCli(p.dir, ['run', '--record'])
  assert.equal(r.code, 0, r.stdout + r.stderr)
  return p
}

async function cli(dir: string, args: string[], code = 0) {
  const r = await runCli(dir, args)
  assert.equal(r.code, code, r.stdout + r.stderr)
  return r.stdout
}

function regradeFiles(dir: string): RegradeRecord[] {
  const history = join(dir, HISTORY)
  return readdirSync(history)
    .filter((n) => !n.endsWith('.json') && !n.startsWith('.'))
    .flatMap((run) => {
      const folder = join(history, run, 'regrades')
      if (!existsSync(folder)) return []
      return readdirSync(folder)
        .sort()
        .map((n) => JSON.parse(readFileSync(join(folder, n), 'utf8')) as RegradeRecord)
    })
}

/** A committed project with one recorded run of `evalSrc` as `evals/one.eval.ts`. */
async function setup(
  name: string,
  o: {
    harness?: string
    evalSrc: string
    graders?: string
    artifacts?: string
    judge?: string
    code?: number
    env?: Record<string, string>
  },
) {
  const p = await project(name, {
    '.gitignore': '.reeval/\nnode_modules/\nsandboxes/\n',
    'reeval.config.ts': fakeConfig({
      harness: o.harness ?? harness,
      ...(o.judge ? { judge: o.judge } : {}),
      ...(o.artifacts ? { extra: `history: { artifacts: '${o.artifacts}' },` } : {}),
    }),
    'evals/graders.ts': o.graders ?? 'export {}\n',
    'evals/one.eval.ts': o.evalSrc,
  })
  sh(p.dir, 'init', '-q', '-b', 'main')
  sh(p.dir, 'add', '-A')
  sh(p.dir, 'commit', '-q', '-m', 'init')
  const r = await runCli(p.dir, ['run', '--record'], { env: o.env ?? {} })
  assert.equal(r.code, o.code ?? 0, r.stdout + r.stderr)
  return p
}

const actions = (r: RegradeRecord | undefined) =>
  r?.attempts[0]?.actions.map((a) => [a.grader, a.action])

describe('reeval regrade', () => {
  test('re-scores a grader whose score options changed, and recomputes one whose code did', async () => {
    const p = await recorded('regrade-code', {
      artifacts: 'all',
      list: "says, key, inDiff('out.txt')",
    })
    await writeFile(
      join(p.dir, 'evals/one.eval.ts'),
      evalFile("says, key, inDiff('out.txt', { required: true })"),
    )
    const plan = await cli(p.dir, ['regrade', '--dry-run'])
    assert.match(plan, /1 eval, 1 attempt in 1 run: 0 to recompute, 1 to re-score, 0 unchanged/)
    assert.match(plan, /in-diff:out\.txt {2,}score changed {2,}re-score {2,}no calls/)
    assert.match(plan, /says {2,}unchanged {2,}keep/)
    assert.deepEqual(regradeFiles(p.dir), [], '--dry-run writes nothing')

    const rescored = await cli(p.dir, ['regrade'])
    assert.match(rescored, /regraded 1 eval in 1 run {3}0 recomputed, 1 re-scored, 0 skipped/)
    assert.match(rescored, /key {2,}recorded/)
    assert.deepEqual(actions(regradeFiles(p.dir)[0]), [
      ['says', 'kept'],
      ['key', 'kept'],
      ['in-diff:out.txt', 'rescored'],
    ])
    assert.equal(regradeFiles(p.dir)[0]?.attempts[0]?.grades[2]?.required, true)
    assert.match(
      await cli(p.dir, ['regrade', '--dry-run']),
      /Nothing changed: every grade is current/,
    )

    // The conservative function digest covers the grader's whole module, so key recomputes too.
    await writeFile(join(p.dir, 'evals/graders.ts'), graders('goodbye'))
    const plan2 = await cli(p.dir, ['regrade', '--dry-run'])
    assert.match(plan2, /says {2,}grader changed: code {2,}recompute {2,}1 attempt/)
    assert.match(plan2, /key {2,}grader changed: code {2,}recompute {2,}1 attempt/)
    assert.match(plan2, /in-diff:out\.txt {2,}unchanged {2,}keep/)
    const recomputed = await cli(p.dir, ['regrade', '--yes'])
    assert.match(recomputed, /says {2,}1\/1 → 0\/1 passed/)
    assert.match(recomputed, /attempts {2,}1\/1 → 0\/1 passed/)
    const second = regradeFiles(p.dir)[1]
    assert.deepEqual(actions(second), [
      ['says', 'recomputed'],
      ['key', 'recomputed'],
      ['in-diff:out.txt', 'kept'],
    ])
    assert.equal(
      second?.regradeOf,
      readdirSync(join(p.dir, HISTORY))
        .find((n) => n.endsWith('.json'))
        ?.slice(0, -5),
    )
    assert.deepEqual([second?.attempts[0]?.outcome, second?.attempts[0]?.score], ['fail', 0.5])

    assert.match(await cli(p.dir, ['history']), /✗↻ {4}0\/1 {2}one/)
    assert.match(await cli(p.dir, ['history']), /↻ regraded/)
    assert.match(await cli(p.dir, ['history', '--original']), /✓ +1\/1 {2}one/)
    const show = await cli(p.dir, ['show'])
    assert.match(show, /Regraded +↻ one by 2 regrades/)
    assert.match(show, /^ {4}#1 {2}50% {2}says 0%$/m, 'the regraded grade')
    const original = await cli(p.dir, ['show', '--original'])
    assert.doesNotMatch(original, /Regraded/)
    assert.doesNotMatch(original, /says 0%/, 'canary: the recorded grade passed')
    const listed = await cli(p.dir, ['show', '--regrades'])
    assert.match(listed, /2 regrades of /)
    assert.match(listed, /every changed grader {2}1 attempt: 1\/1 → 1\/1 passed/)
    assert.match(listed, /every changed grader {2}1 attempt: 1\/1 → 0\/1 passed/)
    const json = JSON.parse(await cli(p.dir, ['show', '--regrades', '--json'])) as RegradeRecord[]
    assert.equal(json.length, 2)
  })

  test('keeps a removed grader, computes a new judge grader, and compare reads grader changed', async () => {
    const p = await recorded('regrade-judge', {
      artifacts: 'all',
      judge: '{ model: fakeJudge({ score: 0.2 }) }',
    })
    await writeFile(join(p.dir, 'evals/one.eval.ts'), evalFile('says, quality'))
    sh(p.dir, 'commit', '-qam', 'grade the reply')
    const plan = await cli(p.dir, ['regrade', '--dry-run'])
    assert.match(plan, /quality {2,}new {2,}compute {2,}1 judge call/)
    assert.match(plan, /key {2,}grader not found {2,}keep old grade/)

    // The run on today's graders, before the regrade: compare reads its grader changed.
    const head = await runCli(p.dir, ['run', '--record'])
    assert.equal(head.code, 1, head.stdout + head.stderr)
    const before = await cli(p.dir, ['compare', '--json'])
    const row = (
      JSON.parse(before) as { rows: Array<{ id: string; status: string; changes?: string[] }> }
    ).rows[0]
    assert.equal(row?.status, 'drift')
    assert.ok(row?.changes?.includes('grader changed'), JSON.stringify(row))

    await cli(p.dir, [
      'regrade',
      'one',
      '--grader',
      'quality',
      '--all-branches',
      '--since',
      '1d',
      '--yes',
    ])
    const files = regradeFiles(p.dir)
    const first = files.find((f) => f.attempts[0]?.actions.some((a) => a.action === 'new'))
    assert.ok(first, JSON.stringify(files))
    const quality = first.attempts[0]?.grades.find((g) => g.grader === 'quality')
    assert.deepEqual(
      [quality?.grade, quality?.score, quality?.judge?.calls?.[0]?.model],
      [false, 0, 'fake'],
    )
    assert.ok(
      first.attempts[0]?.grades.some((g) => g.grader === 'key'),
      'the removed grader kept',
    )
    assert.deepEqual(first.graders, ['quality'])
    const after = JSON.parse(await cli(p.dir, ['compare', '--json'])) as {
      rows: Array<{ status: string; changes?: string[] }>
    }
    assert.equal(after.rows[0]?.status, 'same', JSON.stringify(after.rows[0]))
  })

  test("marks a grader inputs missing when the run didn't keep what it reads", async () => {
    const p = await recorded('regrade-missing')
    await writeFile(join(p.dir, 'evals/graders.ts'), graders('goodbye'))
    const plan = await cli(p.dir, ['regrade'])
    assert.match(plan, /0 to recompute, 0 to re-score, 0 unchanged, 1 can't be regraded/)
    assert.match(plan, /says {2,}inputs missing {2,}skip 1 {2,}the transcript wasn't kept/)
    assert.match(plan, /Nothing to regrade: 1 attempt can't be regraded/)
    assert.deepEqual(regradeFiles(p.dir), [])

    const bad = await recorded('regrade-bad-line', { artifacts: 'all' })
    const run = readdirSync(join(bad.dir, HISTORY))
      .find((n) => n.endsWith('.json'))
      ?.slice(0, -5)
    const transcript = execFileSync(
      'find',
      [join(bad.dir, HISTORY, run ?? ''), '-name', 'transcript.jsonl'],
      {
        encoding: 'utf8',
      },
    ).trim()
    await writeFile(transcript, `${readFileSync(transcript, 'utf8')}{not json\n`)
    await writeFile(join(bad.dir, 'evals/graders.ts'), graders('goodbye'))
    assert.match(
      await cli(bad.dir, ['regrade', '--yes']),
      /says {2,}inputs missing {2,}skip 1 {2,}line \d+ of .*transcript\.jsonl isn't JSON/,
    )
  })

  test("marks built-ins over execs and observations inputs missing when the run didn't keep them", async () => {
    const evalSrc = (list: string) => `import { defineEval } from 'reeval'
import { inDiff, observed, succeeded } from 'reeval/graders'
export default defineEval({ graders: [${list}], task: async (c) => {
  await c.send('write it')
  await c.exec('echo hi')
  c.observe('big', 'x'.repeat(5000))
} })
`
    const failures = await setup('regrade-execs', {
      evalSrc: evalSrc("inDiff('out.txt')"),
      artifacts: 'failures',
    })
    await writeFile(
      join(failures.dir, 'evals/one.eval.ts'),
      evalSrc("inDiff('out.txt'), succeeded('echo hi', { required: true })"),
    )
    const plan = await cli(failures.dir, ['regrade', '--yes'])
    assert.match(
      plan,
      /succeeded:echo hi {2,}inputs missing {2,}skip 1 {2,}the c\.exec results weren't kept/,
    )
    assert.deepEqual(regradeFiles(failures.dir), [])

    const none = await setup('regrade-observed', {
      evalSrc: evalSrc("inDiff('out.txt')"),
      artifacts: 'none',
    })
    await writeFile(
      join(none.dir, 'evals/one.eval.ts'),
      evalSrc("inDiff('out.txt'), observed('big', (v) => typeof v === 'string')"),
    )
    assert.match(
      await cli(none.dir, ['regrade', '--yes']),
      /observed:big {2,}inputs missing {2,}skip 1 {2,}observation big wasn't kept/,
    )
    assert.deepEqual(regradeFiles(none.dir), [])
  })

  test('marks a code grader inputs missing over a transcript the record cut', async () => {
    const mid = `import { defineGrader } from 'reeval'
export const mid = defineGrader('mid', {
  grade: (c) => c.turns.some((t) => t.transcript.some((e) => typeof e.output === 'string' && e.output.includes('MIDDLE'))),
})
`
    const p = await setup('regrade-cut', {
      harness:
        "{ script: [[{ exec: `node -e \"process.stdout.write('a'.repeat(100000)+'MIDDLE'+'b'.repeat(100000))\"` }, { reply: 'ok' }]] }",
      graders: mid,
      artifacts: 'all',
      evalSrc: `import { defineEval } from 'reeval'
import { mid } from './graders.ts'
export default defineEval({ graders: [mid], task: async (c) => void (await c.send('hi')) })
`,
    })
    await writeFile(join(p.dir, 'evals/graders.ts'), `${mid}// touched\n`)
    const out = await cli(p.dir, ['regrade', '--yes'])
    assert.match(out, /mid {2,}inputs missing {2,}skip 1 {2,}the kept transcript cuts tool input/)
    assert.deepEqual(regradeFiles(p.dir), [])
    assert.match(await cli(p.dir, ['history']), /✓ +1\/1 {2}one/)
  })

  test("records a code grader's own throw as a run would, scoring 0", async () => {
    const parsed = (body: string) => `import { defineGrader } from 'reeval'
export const parsed = defineGrader('parsed', { files: ['out.txt'], required: true, grade: async (c) => ${body} })
`
    const p = await setup('regrade-throws', {
      artifacts: 'all',
      graders: parsed("(await c.readFile('out.txt')) === 'hello'"),
      evalSrc: `import { defineEval } from 'reeval'
import { parsed } from './graders.ts'
export default defineEval({ graders: [parsed], task: async (c) => void (await c.send('hi')) })
`,
    })
    await writeFile(
      join(p.dir, 'evals/graders.ts'),
      parsed("JSON.parse(await c.readFile('out.txt')).ok === true"),
    )
    const out = await runCli(p.dir, ['regrade', '--yes'])
    assert.equal(out.code, 0, out.stdout + out.stderr)
    assert.doesNotMatch(out.stdout, /failed/)
    const [file] = regradeFiles(p.dir)
    assert.deepEqual(actions(file), [['parsed', 'recomputed']])
    const grade = file?.attempts[0]?.grades[0]
    assert.equal(grade?.score, 0)
    assert.match(grade?.error ?? '', /JSON/)
    assert.match(await cli(p.dir, ['history']), /✗↻? +0\/1 {2}one/)
    assert.match(
      await cli(p.dir, ['regrade', '--dry-run']),
      /Nothing changed: every grade is current/,
    )
  })

  test('times out a code grader that never settles and keeps the stored grade', async () => {
    const waits = (body: string) => `import { defineGrader } from 'reeval'
export const waits = defineGrader('waits', { timeout: '200ms', grade: () => ${body} })
`
    const p = await setup('regrade-hangs', {
      artifacts: 'all',
      graders: waits('true'),
      evalSrc: `import { defineEval } from 'reeval'
import { waits } from './graders.ts'
export default defineEval({ graders: [waits], task: async (c) => void (await c.send('hi')) })
`,
    })
    await writeFile(join(p.dir, 'evals/graders.ts'), waits('new Promise(() => {})'))
    const out = await runCli(p.dir, ['regrade', '--yes'])
    assert.equal(out.code, 1, out.stdout + out.stderr)
    assert.match(out.stdout, /1 grade failed\b/)
    assert.match(out.stdout, /waits on .+: grade timed out after 200ms$/m)
    const stored = JSON.parse(await cli(p.dir, ['show', '--json'])).evals[0].attempts[0].grades[0]
    assert.deepEqual([stored.score, stored.error], [1, undefined])
  })

  test('keeps the stored grade and fails when a judge errors or has no model', async () => {
    const quality = (question: string) => `import { defineGrader } from 'reeval'
export const quality = defineGrader('quality', { judge: { question: '${question}', inputs: { output: true } } })
`
    const p = await setup('regrade-judge-down', {
      artifacts: 'all',
      judge: '{ model: fakeJudge({ score: 0.9 }) }',
      graders: quality('Clear?'),
      evalSrc: `import { defineEval } from 'reeval'
import { quality } from './graders.ts'
export default defineEval({ graders: [quality], task: async (c) => void (await c.send('hi')) })
`,
    })
    await writeFile(join(p.dir, 'evals/graders.ts'), quality('Clearer?'))
    await writeFile(
      join(p.dir, 'evals/one.eval.ts'),
      `import { defineEval } from 'reeval'
import { fakeJudge } from 'reeval/judge'
import { quality } from './graders.ts'
const down = fakeJudge({ score: () => { throw new Error('provider unreachable') } })
export default defineEval({ graders: [quality], judge: { model: down }, task: async (c) => void (await c.send('hi')) })
`,
    )
    const out = await runCli(p.dir, ['regrade', '--yes'])
    assert.equal(out.code, 1, out.stdout + out.stderr)
    assert.match(out.stdout, /1 grade failed\b/)
    assert.match(out.stdout, /quality on .+: .*provider unreachable/)
    for (const f of regradeFiles(p.dir)) {
      for (const a of f.attempts) assert.equal(a.actions[0]?.action, 'failed')
    }
    const stored = JSON.parse(await cli(p.dir, ['show', '--json'])).evals[0].attempts[0].grades[0]
    assert.deepEqual([stored.score, stored.error], [1, undefined])
    assert.match(await cli(p.dir, ['history']), /✓↻? +1\/1 {2}one/)

    const judged = await setup('regrade-no-model', {
      artifacts: 'all',
      judge: '{ model: fakeJudge({ score: 0.9 }) }',
      graders: `import { defineGrader } from 'reeval'
export const quality = defineGrader('quality', { judge: { question: 'Clear?', inputs: { output: true } } })
`,
      evalSrc: `import { defineEval } from 'reeval'
import { quality } from './graders.ts'
export default defineEval({ graders: [quality], task: async (c) => void (await c.send('hi')) })
`,
    })
    await writeFile(join(judged.dir, 'reeval.config.ts'), fakeConfig({ harness, judge: '{}' }))
    const gone = await runCli(judged.dir, ['regrade', '--yes'])
    assert.equal(gone.code, 1, gone.stdout + gone.stderr)
    assert.match(gone.stdout, /quality {2,}inputs missing {2,}skip 1 {2,}no judge model/)
    assert.match(gone.stdout, /1 grader can't run as configured today \(quality\)/)
    assert.deepEqual(regradeFiles(judged.dir), [])
  })

  test("re-scores a judge grader's score map without calling the judge", async () => {
    const quality = (low: number) => `import { defineGrader } from 'reeval'
export const quality = defineGrader('quality', {
  judge: { question: 'Clear?', inputs: { output: true } },
  score: { true: 1, false: ${low} },
})
`
    const p = await setup('regrade-score-map', {
      artifacts: 'all',
      judge: '{ model: fakeJudge({ score: 0.2 }) }',
      graders: quality(0),
      evalSrc: `import { defineEval, regression } from 'reeval'
import { quality } from './graders.ts'
export default defineEval({ graders: [quality], target: regression(0.4), task: async (c) => void (await c.send('hi')) })
`,
      code: 1,
    })
    await writeFile(join(p.dir, 'evals/graders.ts'), quality(0.5))
    const out = await cli(p.dir, ['regrade', '--yes'])
    assert.match(out, /quality {2,}score changed {2,}re-score {2,}no calls/)
    const [file] = regradeFiles(p.dir)
    const grade = file?.attempts[0]?.grades[0]
    assert.deepEqual(
      [
        file?.attempts[0]?.actions[0]?.action,
        grade?.grade,
        grade?.score,
        grade?.judge?.calls?.length,
      ],
      ['rescored', false, 0.5, 1],
    )
    assert.match(out, /attempts {2,}0\/1 → 1\/1 passed/)
  })

  test('treats a case whose data changed as inputs missing, and keeps a removed case', async () => {
    const evalSrc = (
      cases: string,
      extra = '',
    ) => `import { defineEval, defineGrader } from 'reeval'
import { named } from './graders.ts'
const g = defineGrader('wants', { files: ['out.txt'], grade: async (c) => (await c.readFile('out.txt')) === c.case.want ${extra} })
export default defineEval({ cases: [${cases}], graders: [g, named], task: async (c, item) => void (await c.send('write ' + item.want)) })
`
    const p = await setup('regrade-case', {
      graders: `import { defineGrader } from 'reeval'
export const named = defineGrader('named', { grade: (c) => c.case.key.length > 0 })
`,
      evalSrc: evalSrc("{ key: 'k', want: 'hello' }, { key: 'gone', want: 'hello' }"),
      artifacts: 'all',
    })
    await writeFile(
      join(p.dir, 'evals/one.eval.ts'),
      evalSrc("{ key: 'k', want: 'bye' }", '&& true'),
    )
    const out = await cli(p.dir, ['regrade', '--yes'])
    assert.match(out, /wants {2,}inputs missing {2,}skip 1 {2,}case changed: case "k"/)
    assert.match(out, /inputs missing {2,}skip 1 {2,}case "gone" is no longer in the eval's cases/)
    assert.match(out, /named {2,}unchanged {2,}keep/)
    assert.doesNotMatch(out, /named {2,}inputs missing/)
    assert.deepEqual(regradeFiles(p.dir), [])
  })

  test("reads a case holding a secret() value unchanged, its hash masked as the run's was", async () => {
    const named = `import { defineGrader } from 'reeval'
export const named = defineGrader('named', { grade: (c) => c.case.key === '0' })
`
    const p = await setup('regrade-case-secret', {
      graders: named,
      artifacts: 'all',
      env: { DB_CONN: 'pgpass1' },
      evalSrc: `import { defineEnvironment, defineEval } from 'reeval'
import { named } from './graders.ts'
const db = defineEnvironment('db', ({ secret }) => ({ env: { DB_CONN: secret.fromEnv('DB_CONN') } }))
export default defineEval({
  cases: [{ key: '0', conn: process.env.DB_CONN }],
  environment: db,
  graders: [named],
  task: async (c) => void (await c.send('write it')),
})
`,
    })
    await writeFile(join(p.dir, 'evals/graders.ts'), `${named}// touched\n`)
    const unset = await runCli(p.dir, ['regrade', '--dry-run'], { env: { DB_CONN: '' } })
    assert.match(unset.stdout, /reads secret from DB_CONN, unset here/, unset.stdout + unset.stderr)
    assert.doesNotMatch(unset.stdout, /case changed/)
    const r = await runCli(p.dir, ['regrade', '--yes'], { env: { DB_CONN: 'pgpass1' } })
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.doesNotMatch(r.stdout, /case changed/)
    assert.match(r.stdout, /named {2,}grader changed: code {2,}recompute/)
    assert.deepEqual(actions(regradeFiles(p.dir)[0]), [['named', 'recomputed']])
  })

  test('exits once done though an eval file leaves a timer running', async () => {
    const evalSrc = (list: string) => `import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
setInterval(() => {}, 1000)
export default defineEval({ graders: [${list}], task: async (c) => void (await c.send('w')) })
`
    const p = await setup('regrade-timer', {
      artifacts: 'all',
      evalSrc: evalSrc("hasFile('out.txt')"),
    })
    await writeFile(
      join(p.dir, 'evals/one.eval.ts'),
      evalSrc("hasFile('out.txt', { required: true })"),
    )
    const r = await runCli(p.dir, ['regrade', '--yes'], { deadlineMs: 20_000, graceMs: 1_000 })
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.equal(regradeFiles(p.dir).length, 1)
  })

  test('two --grader regrades of one run both hold', async () => {
    const evalSrc = (a: boolean, b: boolean) => `import { defineEval } from 'reeval'
import { hasFile, inDiff } from 'reeval/graders'
export default defineEval({ graders: [inDiff('out.txt', { required: ${a} }), hasFile('out.txt', { required: ${b} })], task: async (c) => void (await c.send('w')) })
`
    const p = await setup('regrade-merge', { evalSrc: evalSrc(false, false), artifacts: 'all' })
    await writeFile(join(p.dir, 'evals/one.eval.ts'), evalSrc(true, true))
    const [x, y] = await Promise.all([
      runCli(p.dir, ['regrade', '--grader', 'in-diff:out.txt', '--yes']),
      runCli(p.dir, ['regrade', '--grader', 'has-file:out.txt', '--yes']),
    ])
    assert.deepEqual([x.code, y.code], [0, 0], x.stderr + y.stderr)
    assert.equal(regradeFiles(p.dir).length, 2)
    assert.match(
      await cli(p.dir, ['regrade', '--dry-run']),
      /Nothing changed: every grade is current/,
    )
    const grades = JSON.parse(await cli(p.dir, ['show', '--json'])).evals[0].attempts[0].grades
    assert.deepEqual(
      grades.map((g: { grader: string; required: boolean }) => [g.grader, g.required]),
      [
        ['in-diff:out.txt', true],
        ['has-file:out.txt', true],
      ],
    )
  })

  test('recomputes a code grader on an attempt that ran in no environment', async () => {
    const p = await project('regrade-no-environment', {
      '.gitignore': '.reeval/\nnode_modules/\nsandboxes/\n',
      'reeval.config.ts': fakeConfig({ harness, extra: "history: { artifacts: 'all' }," }).replace(
        "environments: defineEnvironment('fake', {}),",
        '',
      ),
      'evals/graders.ts': graders(),
      'evals/one.eval.ts': evalFile(),
    })
    sh(p.dir, 'init', '-q', '-b', 'main')
    sh(p.dir, 'add', '-A')
    sh(p.dir, 'commit', '-q', '-m', 'init')
    await cli(p.dir, ['run', '--record'])
    const [file] = readdirSync(join(p.dir, HISTORY)).filter((n) => n.endsWith('.json'))
    const record = JSON.parse(readFileSync(join(p.dir, HISTORY, file ?? ''), 'utf8'))
    assert.deepEqual(record.environments, [], 'the run declared no environment')

    await writeFile(join(p.dir, 'evals/graders.ts'), graders('goodbye'))
    const out = await cli(p.dir, ['regrade', '-y'])
    assert.doesNotMatch(out, /environment record is missing/)
    assert.match(out, /says {2,}1\/1 → 0\/1 passed/)
    assert.deepEqual(actions(regradeFiles(p.dir)[0]), [
      ['says', 'recomputed'],
      ['key', 'recomputed'],
    ])
    assert.match(await cli(p.dir, ['show']), /^ {4}#1 {2}0% {2}says 0%$/m)
    const grades = JSON.parse(await cli(p.dir, ['show', '--json'])).evals[0].attempts[0].grades
    const says = grades.find((g: { grader: string }) => g.grader === 'says')
    assert.deepEqual([says?.grade, says?.score], [false, 0])
  })

  test("marks a code grader inputs missing when the attempt's environment record is gone", async () => {
    const p = await recorded('regrade-environment-gone', { artifacts: 'all' })
    const [file] = readdirSync(join(p.dir, HISTORY)).filter((n) => n.endsWith('.json'))
    const path = join(p.dir, HISTORY, file ?? '')
    const record = JSON.parse(readFileSync(path, 'utf8'))
    assert.equal(record.environments.length, 1)
    await writeFile(path, JSON.stringify({ ...record, environments: [] }))
    await writeFile(join(p.dir, 'evals/graders.ts'), graders('goodbye'))
    const out = await cli(p.dir, ['regrade', '--yes'])
    assert.match(
      out,
      /says {2,}inputs missing {2,}skip 1 {2,}the attempt's environment record is missing/,
    )
    assert.deepEqual(regradeFiles(p.dir), [])
  })

  test('analyze and query read the regraded outcome', async () => {
    const p = await recorded('regrade-readers', { artifacts: 'all' })
    await writeFile(join(p.dir, 'evals/graders.ts'), graders('goodbye'))
    await cli(p.dir, ['regrade', '--yes'])
    const context = await cli(p.dir, ['analyze', '--context'])
    assert.match(context, /"outcome":\s*"fail"/)
    assert.doesNotMatch(context, /"outcome":\s*"pass"/)
    assert.match(await cli(p.dir, ['query', 'SELECT outcome FROM attempts']), /fail/)
  })
})

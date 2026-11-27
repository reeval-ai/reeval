import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { appendFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { withUnknownFields } from '../scripts/schema/validate.ts'
import { fakeAgent } from '../src/agent.ts'
import { defineEnvironment } from '../src/environment.ts'
import { optionsHash } from '../src/eval-source.ts'
import { fingerprintOf } from '../src/history/assemble.ts'
import { renderSummary } from '../src/history/summary.ts'
import type { RunRecord } from '../src/history/types.ts'
import { sha256 } from '../src/ids.ts'
import { fakeSandbox } from '../src/sandbox.ts'
import { templateName } from '../src/view/family.ts'
import { harnessLabel, languageLabel, runtimeLabel } from '../src/view/model.ts'
import { MIGRATIONS, readableRecord } from '../src/view/record.ts'
import {
  baseEnv,
  fakeConfig,
  noSignals,
  project,
  readRun,
  recordedRuns,
  runCli,
} from './helpers.ts'
import { fixture, testDir } from './support/fixture.ts'
import { writeStudioResponses } from './support/studio.ts'

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
const agent = `import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
export default defineEval({
  graders: [judge('Did it write hello.txt?', { inputs: { diff: true } })],
  async task(c) {
    await c.send('write hello.txt')
  },
})
`
const failing = `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('write hello.txt')
    assert.equal((await c.exec('exit 4')).exitCode, 0)
  },
})
`
const harness = (text = 'Wrote it') => `{ files: { 'hello.txt': 'hi\\n' }, text: '${text}' }`

const BEFORE_100 = 'fixtures/records/before-100'

/** Ports the before-100 corpus evals to one-eval-per-file so CLI commands still run. */
const portBefore100 = async (dir: string) => {
  await writeFile(
    join(dir, 'reeval.config.ts'),
    fakeConfig({
      harness: `{ files: { 'greet.js': "export const greet = (n) => 'Hello, ' + n\\n" } }`,
    }),
  )
  await writeFile(
    join(dir, 'evals/writes-greet.eval.ts'),
    `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('Write greet.js')
    assert.match((await c.readFile('greet.js')) ?? '', /Hello/)
  },
})
`,
  )
  await writeFile(
    join(dir, 'evals/greets-in-french.eval.ts'),
    `import { defineEval } from 'reeval'
export default defineEval({ skip: 'not written yet', async task() {} })
`,
  )
}

/** A reeval project that is its own committed git repo, with a known author. */
async function gitProject(name: string, files: Record<string, string>, extra = '') {
  const p = await project(name, {
    '.gitignore': '.reeval/\nnode_modules/\nsandboxes/\n',
    'reeval.config.ts': fakeConfig({ harness: harness(), extra }),
    ...files,
  })
  sh(p.dir, 'init', '-q', '-b', 'main')
  sh(p.dir, 'config', 'user.name', 'Test Author')
  sh(p.dir, 'config', 'user.email', 'test@example.com')
  sh(p.dir, 'add', '-A')
  sh(p.dir, 'commit', '-q', '-m', 'init')
  return p
}

const query = async (dir: string, sql: string) => {
  const r = await runCli(dir, ['query', sql, '--json'])
  assert.equal(r.code, 0, r.stdout + r.stderr)
  return JSON.parse(r.stdout) as Array<Record<string, unknown>>
}

describe('what a record says about comparability', () => {
  const importing = ({
    revision = 1,
    prompt = 'prompt',
    runs = 1,
    tags = "'a'",
    sibling = 'write other.txt',
    extra = '',
  } = {}) => ({
    'evals/agent.eval.ts': `import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { prompt } from './helpers.ts'
const unused = 1
export default defineEval({
  revision: ${revision},
  trials: ${runs},
  tags: [${tags}]${extra},
  graders: [judge('Did it write hello.txt?', { inputs: { diff: true } })],
  async task(c) {
    await c.send(${prompt})
  },
})
`,
    'evals/sibling.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('${sibling}')
  },
})
`,
  })
  const compareJson = async (dir: string) => {
    const r = await runCli(dir, ['compare', '--json'])
    assert.equal(r.code, 0, r.stderr)
    return JSON.parse(r.stdout) as {
      rows: Array<{ id: string; status: string; changes?: string[] }>
    }
  }
  const agentRow = async (dir: string) => {
    assert.equal((await runCli(dir)).code, 0)
    const row = (await compareJson(dir)).rows.find((r) => r.id.endsWith('agent'))
    return [row?.status, row?.changes ?? []]
  }

  test("an eval's fingerprint covers its body, options and revision, not its file or helpers, and reeval compare names what changed", async () => {
    const p = await gitProject('eval-source', {
      ...importing(),
      'evals/helpers.ts': "export const prompt = 'write hello.txt'\n",
      'lib/helpers.ts': "export const other = 'write third.txt'\n",
    })
    const write = async (files: ReturnType<typeof importing>) => {
      await writeFile(join(p.dir, 'evals/agent.eval.ts'), files['evals/agent.eval.ts'])
      await writeFile(join(p.dir, 'evals/sibling.eval.ts'), files['evals/sibling.eval.ts'])
    }
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    const base = readRun(p.dir, { history: HISTORY })
    const entry = base.run.evals.find((e) => e.name === 'agent')
    assert.deepEqual(
      entry?.sources.map((s) => s.path),
      ['evals/agent.eval.ts'],
    )
    assert.equal(entry?.revision, 1)
    assert.match(entry?.source?.body ?? '', /^[0-9a-f]{64}$/)
    for (const cell of entry?.cells ?? []) {
      assert.equal(cell.fingerprint, fingerprintOf(cell.fingerprintParts))
    }

    // A helper, the rest of the file, a sibling eval and tags change nothing.
    await writeFile(join(p.dir, 'evals/helpers.ts'), "export const prompt = 'write hello.txt!'\n")
    const tweaked = importing({ tags: "'a', 'b'", sibling: 'write another.txt' })
    tweaked['evals/agent.eval.ts'] = tweaked['evals/agent.eval.ts'].replace('= 1', '= 2')
    await write(tweaked)
    assert.deepEqual(await agentRow(p.dir), ['same', []])
    const sibling = (await compareJson(p.dir)).rows.find((r) => r.id === 'sibling')
    assert.deepEqual([sibling?.status, sibling?.changes], ['drift', ['body changed']])
    await write(importing({ tags: "'a', 'b'", sibling: 'write another.txt' }))
    assert.deepEqual(await agentRow(p.dir), ['same', []])

    await write(importing({ revision: 2 }))
    assert.deepEqual(await agentRow(p.dir), ['drift', ['revision 1 → 2']])
    const text = await runCli(p.dir, ['compare'])
    assert.match(text.stdout, /^can't compare {4}agent\n {2}changed {10}revision 1 → 2\n/m)

    await write(importing({ prompt: "prompt + '!'" }))
    assert.deepEqual(await agentRow(p.dir), ['drift', ['body changed']])
    await write(importing({ trials: 2, extra: ", timeout: '10m'" }))
    assert.deepEqual(await agentRow(p.dir), ['same', []], 'runs and timeout change nothing')
    await write(importing({ extra: ", pin: ['agents']" }))
    const [status, changes] = await agentRow(p.dir)
    assert.equal(status, 'drift')
    assert.ok((changes as string[]).includes('options changed'), String(changes))

    await write(importing())
    await writeFile(
      join(p.dir, 'reeval.config.ts'),
      fakeConfig({ harness: harness('Wrote it, differently') }),
    )
    assert.deepEqual(await agentRow(p.dir), ['drift', ['agent config changed']])
  })

  test("a case's hash masks its secrets, so the record can't confirm a guess and a rotated secret stays the same eval", async () => {
    const each = (user: string) => `import { defineEval } from 'reeval'
export default defineEval({
  cases: [{ key: '0', user: '${user}', password: process.env.DB_PASSWORD }],
  async task(c) {
    await c.send('write hello.txt')
  },
})
`
    const p = await gitProject('case-secret', { 'evals/logs-in.eval.ts': each('ada') })
    const secret = { env: { DB_PASSWORD: 'postgres-dev-pass' } }
    assert.equal((await runCli(p.dir, ['run', '--record'], secret)).code, 0)
    const entry = readRun(p.dir, { history: HISTORY }).run.evals[0]
    assert.equal(
      entry?.cases?.[0]?.hash,
      sha256('{"key":"0","password":"[REDACTED]","user":"ada"}'),
    )
    assert.notEqual(
      entry?.cases?.[0]?.hash,
      sha256('{"key":"0","password":"postgres-dev-pass","user":"ada"}'),
      'canary: the raw case would confirm a guessed password',
    )
    const row = async (env: Record<string, string>) => {
      assert.equal((await runCli(p.dir, ['run'], { env })).code, 0)
      const r = (await compareJson(p.dir)).rows[0]
      return [r?.status, r?.changes ?? []]
    }
    assert.deepEqual(await row({ DB_PASSWORD: 'postgres-ci-pass' }), ['same', []])
    await writeFile(join(p.dir, 'evals/logs-in.eval.ts'), each('grace'))
    assert.deepEqual(await row(secret.env), ['drift', ['case data changed']])
  })

  test("a case's hash masks the value of its environment's secret(), whatever the variable is called", async () => {
    const p = await gitProject('case-declared-secret', {
      'evals/connects.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
const db = defineEnvironment('db', ({ secret }) => ({ env: { DB_CONN: secret.fromEnv('DB_CONN') } }))
export default defineEval({
  cases: [{ key: '0', conn: process.env.DB_CONN }],
  environment: db,
  async task(c) {
    await c.send('write hello.txt')
  },
})
`,
    })
    const run = await runCli(p.dir, ['run', '--record'], { env: { DB_CONN: 'pgpass1' } })
    assert.equal(run.code, 0, run.stderr)
    const entry = readRun(p.dir, { history: HISTORY }).run.evals[0]
    assert.equal(entry?.cases?.[0]?.hash, sha256('{"conn":"[REDACTED]","key":"0"}'))
    assert.notEqual(
      entry?.cases?.[0]?.hash,
      sha256('{"conn":"pgpass1","key":"0"}'),
      'canary: DB_CONN is no secret name, so only its secret() masks it',
    )
  })

  test('reeval compare --fail-on-regression fails on a regression and on a failing new eval; no base is no error', async () => {
    const flip = `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('write hello.txt')
    assert.equal(process.env.REEVAL_TEST_BREAK ?? 'ok', 'ok')
  },
})
`
    const p = await gitProject('fail-on-regression', { 'evals/flips.eval.ts': flip })
    const broken = { env: { REEVAL_TEST_BREAK: '1' } }
    const compareCode = async (...args: string[]) => {
      const r = await runCli(p.dir, ['compare', ...args])
      return { code: r.code, out: r.stdout + r.stderr }
    }

    // No recorded run yet: every eval is new, which isn't an error.
    assert.equal((await runCli(p.dir)).code, 0)
    const first = await compareCode()
    assert.equal(first.code, 0, first.out)
    assert.match(
      first.out,
      /^No earlier recorded run to compare \S+ with, so every eval is new\.$/m,
    )
    assert.match(first.out, /^✓ flips {2}mean 100% · 1\/1 trial at 100% {2}regression\(1\)$/m)
    assert.match(first.out, /^1 new eval \(1 on target\)$/m)
    assert.equal((await compareCode('--fail-on-regression')).code, 0)
    assert.equal(JSON.parse((await compareCode('--json')).out).base, null)
    assert.equal((await runCli(p.dir, ['run'], broken)).code, 1)
    const newFailing = await compareCode('--fail-on-regression')
    assert.equal(newFailing.code, 1, newFailing.out)
    assert.match(newFailing.out, /^1 new eval \(1 below\)$/m)
    assert.match(
      (await compareCode('--md')).out,
      /^# flips\n[\s\S]*\*\*mean 0% · 0\/1 trial at 100%\*\*/m,
      'compare --md with no base is the head RunReport',
    )

    // With a recorded base: pass → fail regresses.
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    assert.equal((await runCli(p.dir, ['run'], broken)).code, 1)
    assert.equal((await compareCode('--fail-on-regression')).code, 1)
    assert.equal((await compareCode()).code, 0, 'without the flag, compare exits 0')

    // A new eval that fails fails the check too; one that passes doesn't.
    await writeFile(join(p.dir, 'evals/broken.eval.ts'), failing)
    assert.equal((await runCli(p.dir)).code, 1)
    const added = await compareCode('--fail-on-regression')
    assert.equal(added.code, 1, added.out)
    assert.match(added.out, /^new {14}broken\n {2}head {13}\S+ {2}fail$/m)
    await writeFile(join(p.dir, 'evals/broken.eval.ts'), agent)
    assert.equal((await runCli(p.dir)).code, 0)
    const twin = await compareCode('--fail-on-regression')
    assert.equal(twin.code, 0, twin.out)
  })

  test('reeval compare reads a report-only eval as ran on each side, as reeval history marks it', async () => {
    const flip = (target: string) => `import assert from 'node:assert/strict'
import { capability, defineEval, regression } from 'reeval'
export default defineEval({
  target: ${target},
  async task(c) {
    await c.send('write hello.txt')
    assert.equal(process.env.REEVAL_TEST_BREAK ?? 'ok', 'ok')
  },
})
`
    const p = await gitProject('report-only-compare', {
      'evals/reports.eval.ts': flip('capability()'),
      'evals/blocks.eval.ts': flip('regression()'),
      'evals/demoted.eval.ts': flip(
        'process.env.REEVAL_TEST_BREAK ? capability() : capability(1, { blocking: true })',
      ),
    })
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    assert.equal((await runCli(p.dir, ['run'], { env: { REEVAL_TEST_BREAK: '1' } })).code, 1)
    const flipped = await runCli(p.dir, ['compare'])
    assert.match(flipped.stdout, /^regressed {8}blocks$/m, 'canary: a regression() miss regresses')
    assert.match(
      flipped.stdout,
      /^regressed {8}demoted$/m,
      'a target that stopped blocking shows its flip',
    )
    assert.doesNotMatch(flipped.stdout, /^regressed +reports$/m)
    assert.match(flipped.stdout, /^2 regressed · 1 same$/m, 'a report-only flip is the same')
    const rows = JSON.parse((await runCli(p.dir, ['compare', '--json'])).stdout).rows
    assert.deepEqual(rows.map((r: { id: string; status: string }) => [r.id, r.status]).sort(), [
      ['blocks', 'regressed'],
      ['demoted', 'regressed'],
      ['reports', 'same'],
    ])
    const md = (await runCli(p.dir, ['compare', '--md'])).stdout
    assert.match(md, /^\| reports \| outcome .* \| -100 pts \| Report only \|/m)
    assert.match(md, /^\| demoted \| outcome .* \| Worse \|/m)
    assert.doesNotMatch(md, /Unchanged/, "--md doesn't call a report-only flip unchanged")

    await writeFile(join(p.dir, 'evals/added.eval.ts'), flip('capability()'))
    assert.equal((await runCli(p.dir, ['run'], { env: { REEVAL_TEST_BREAK: '1' } })).code, 1)
    const added = await runCli(p.dir, ['compare'])
    assert.match(
      added.stdout,
      /^new {14}added\n {2}head {13}\S+ {2}ran$/m,
      'a new miss reads as ran',
    )
  })

  test('reeval compare --fail-on-regression fails on a failing eval that changed (not comparable); a passing one is fine', async () => {
    const edited = (prompt: string) => `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('${prompt}')
    assert.equal(process.env.REEVAL_TEST_BREAK ?? 'ok', 'ok')
  },
})
`
    const p = await gitProject('fail-on-drift', {
      'evals/edited.eval.ts': edited('write hello.txt'),
    })
    const compareCode = async (...args: string[]) => {
      const r = await runCli(p.dir, ['compare', ...args])
      return { code: r.code, out: r.stdout + r.stderr }
    }
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)

    await writeFile(join(p.dir, 'evals/edited.eval.ts'), edited('write hello.txt!'))
    assert.equal((await runCli(p.dir, ['run'], { env: { REEVAL_TEST_BREAK: '1' } })).code, 1)
    const failing = await compareCode('--fail-on-regression')
    assert.match(
      failing.out,
      /^can't compare {4}edited\n {2}changed {10}body\n {2}base {13}\S+ {2}pass\n {2}head {13}\S+ {2}fail$/m,
    )
    assert.equal(failing.code, 1, failing.out)
    assert.equal((await compareCode()).code, 0, 'without the flag, compare exits 0')

    // Canary: the same edit, passing, isn't a failure.
    assert.equal((await runCli(p.dir)).code, 0)
    const passing = await compareCode('--fail-on-regression')
    assert.match(passing.out, /^can't compare {4}edited\n(.*\n){2} {2}head {13}\S+ {2}pass$/m)
    assert.equal(passing.code, 0, passing.out)
  })

  test('reeval compare has one row for an eval with cases, gated on its pooled minLift, and --fail-on-regression fails when it goes from pass to fail', async () => {
    // The baseline passes only with REEVAL_TEST_BASE_OK set: then the cases still pass on their
    // own, but the pooled lift is 0 and falls below minLift.
    const pooled = (minLift: number) => `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
const sandbox = fakeSandbox()
const plain = defineEnvironment('plain', { sandbox })
const skilled = defineEnvironment('skilled', ({ skill }) => ({
  sandbox,
  skills: [skill.local('../skills/s')],
}))
export default defineEval({
  cases: [{ key: 'ada' }, { key: 'grace' }, { key: 'linus' }, { key: 'margaret' }, { key: 'dennis' }, { key: 'barbara' }],
  compare: { baseline: plain, variants: [skilled], minLift: ${minLift} },
  async task(c) {
    await c.send('go')
    if (c.trial.cell.role === 'baseline' && process.env.REEVAL_TEST_BASE_OK) return
    assert.notEqual(await c.readFile('ok.txt'), null)
  },
})
`
    const p = await gitProject('compare-family', {
      'reeval.config.ts': fakeConfig({ harness: "{ withSkill: { files: { 'ok.txt': 'y' } } }" }),
      'skills/s/SKILL.md': '---\nname: s\ndescription: A skill. Use when testing.\n---\nBody.\n',
      'evals/writes-ok-txt.eval.ts': pooled(0.2),
    })
    const baseOk = { env: { REEVAL_TEST_BASE_OK: '1' } }
    const compareCode = async (...args: string[]) => {
      const r = await runCli(p.dir, ['compare', ...args])
      return { code: r.code, out: r.stdout + r.stderr }
    }
    const familyRow = async () =>
      (
        JSON.parse((await compareCode('--json')).out).rows as Array<{
          id: string
          status: string
          base: string | null
          head: string | null
          changes?: string[]
          lifts?: Array<{ base: { lo: number; minLift?: number; outcome: string } | null }>
        }>
      ).find((r) => r.id === 'writes-ok-txt')

    assert.equal((await runCli(p.dir)).code, 0)
    const fresh = await compareCode('--fail-on-regression')
    assert.equal(fresh.code, 0, fresh.out)
    assert.match(fresh.out, /^1 new eval \(1 on target\)$/m)
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)

    assert.equal((await runCli(p.dir, ['run'], baseOk)).code, 1, 'the family gate fails the run')
    const regressed = await compareCode('--fail-on-regression')
    assert.equal(regressed.code, 1, regressed.out)
    assert.match(
      regressed.out,
      /^regressed {8}writes-ok-txt\n {2}base +\S+\n {2}head +\S+\n {2}fake\/skilled\/fake {2}lift \+100 \(\+\d+…\+100\) → \+0 \(−\d+…\+\d+\), not by minLift 20$/m,
    )
    assert.match(regressed.out, /^ {2}\+6 same$/m, 'the cases pass on their own')
    assert.match(regressed.out, /^1 regressed$/m)
    const row = await familyRow()
    assert.deepEqual([row?.status, row?.base, row?.head], ['regressed', 'pass', 'fail'])
    assert.equal(row?.lifts?.[0]?.base?.minLift, 0.2)
    assert.equal((await compareCode()).code, 0, 'without the flag, compare exits 0')

    // Canary: the family keeps its lift, so its gate is the same and nothing fails.
    assert.equal((await runCli(p.dir)).code, 0)
    const same = await compareCode('--fail-on-regression')
    assert.equal(same.code, 0, same.out)
    assert.match(same.out, /^1 same$/m)
    assert.equal((await familyRow())?.status, 'same')

    // A changed family can't be compared, and fails the check when its gate fails.
    await writeFile(join(p.dir, 'evals/writes-ok-txt.eval.ts'), pooled(0.3))
    assert.equal((await runCli(p.dir, ['run'], baseOk)).code, 1)
    const drift = await compareCode('--fail-on-regression')
    assert.equal(drift.code, 1, drift.out)
    assert.match(drift.out, /^can't compare {4}writes-ok-txt$/m)
    assert.deepEqual((await familyRow())?.changes, ['options changed'])
    assert.equal((await runCli(p.dir)).code, 0)
    assert.equal((await compareCode('--fail-on-regression')).code, 0, 'canary: passing, it is fine')
  })

  test("reeval compare names a config target change and re-scores base under head's gate", async () => {
    const config = (target: string) =>
      fakeConfig({ harness: harness(), extra: `trials: 2, target: ${target},` })
    const p = await gitProject('compare-gate', {
      'reeval.config.ts': config('capability(1, { blocking: true })'),
      'evals/flaky.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('go')
    const miss = process.env.REEVAL_TEST_BREAK || (c.trial.n === 2 && !process.env.REEVAL_TEST_STEADY)
    assert.equal(miss ? 'miss' : 'ok', 'ok')
  },
})
`,
    })
    type Row = {
      status: string
      base: string
      head: string
      changes?: string[]
      gate?: { base: string; head: string; rescored: string }
    }
    const compareCode = async () => {
      const r = await runCli(p.dir, ['compare', '--fail-on-regression'])
      return { code: r.code, out: r.stdout + r.stderr }
    }
    const row = async () =>
      (JSON.parse((await runCli(p.dir, ['compare', '--json'])).stdout).rows as Row[])[0]
    const setGate = (gate: string) => writeFile(join(p.dir, 'reeval.config.ts'), config(gate))
    const steady = { env: { REEVAL_TEST_STEADY: '1' } }

    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0, 'one pass in two is enough')

    await setGate('regression()')
    assert.equal((await runCli(p.dir)).code, 1, 'the stricter gate fails the run')
    const tightened = await compareCode()
    assert.equal(tightened.code, 0, `only the gate explains the flip\n${tightened.out}`)
    assert.match(
      tightened.out,
      /^gate changed {5}flaky\n {2}gate +any → all {2}base would fail under it\n {2}base +\S+ {2}pass\n {2}head +\S+ {2}fail$/m,
    )
    assert.match(tightened.out, /^1 gate changed$/m)
    const { perCell: _, ...tightenedRow } = (await row()) as Row & { perCell?: unknown }
    assert.deepEqual(tightenedRow, {
      id: 'flaky',
      status: 'gate',
      base: 'pass',
      head: 'fail',
      changes: ['gate changed'],
      gate: { base: 'any', head: 'all', rescored: 'fail' },
      scores: {
        base: { meanScore: 0.5, passAtK: 1, passHatK: 0 },
        head: { meanScore: 0.5, passAtK: 1, passHatK: 0 },
      },
    })

    // Canary: base would still pass under head's looser gate, so head failing it is a regression.
    assert.equal((await runCli(p.dir, ['run', '--record'], steady)).code, 0)
    await setGate('capability(1, { blocking: true })')
    assert.equal((await runCli(p.dir, ['run'], { env: { REEVAL_TEST_BREAK: '1' } })).code, 1)
    const regressed = await compareCode()
    assert.equal(regressed.code, 1, regressed.out)
    assert.match(regressed.out, /^ {2}gate +all → any {2}base would still pass under it$/m)
    assert.deepEqual((await row())?.gate?.rescored, 'pass')
    assert.equal((await row())?.status, 'regressed')

    // Twin: the same gate as base has no gate change to name.
    await setGate('regression()')
    assert.equal((await runCli(p.dir, ['run'], steady)).code, 0)
    assert.equal((await compareCode()).code, 0)
    const same = await row()
    assert.deepEqual([same?.status, same?.changes, same?.gate], ['same', undefined, undefined])

    // A regression() threshold decides each trial's outcome, so runs under another one differ.
    await setGate('regression(0.7)')
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 1)
    await setGate('regression(0.8)')
    assert.equal((await runCli(p.dir)).code, 1)
    const threshold = await row()
    assert.notEqual(threshold?.status, 'same')
    assert.ok(threshold?.changes?.includes('target threshold changed'), JSON.stringify(threshold))
  })

  test('a target change leaves an eval with cases comparable, and its real regression still fails', async () => {
    const config = (target: string) =>
      fakeConfig({
        harness: "{ withSkill: { files: { 'ok.txt': 'y' } } }",
        extra: `target: ${target},`,
      })
    const p = await gitProject('compare-family-gate-change', {
      'reeval.config.ts': config('regression()'),
      'skills/s/SKILL.md': '---\nname: s\ndescription: A skill. Use when testing.\n---\nBody.\n',
      'evals/writes-ok-txt.eval.ts': `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
const sandbox = fakeSandbox()
const plain = defineEnvironment('plain', { sandbox })
const skilled = defineEnvironment('skilled', ({ skill }) => ({
  sandbox,
  skills: [skill.local('../skills/s')],
}))
export default defineEval({
  cases: [{ key: 'ada' }, { key: 'grace' }, { key: 'linus' }, { key: 'margaret' }, { key: 'dennis' }, { key: 'barbara' }],
  compare: { baseline: plain, variants: [skilled], minLift: 0.2 },
  async task(c) {
    await c.send('go')
    if (c.trial.cell.role === 'baseline' && process.env.REEVAL_TEST_BASE_OK) return
    assert.notEqual(await c.readFile('ok.txt'), null)
  },
})
`,
    })
    type Row = { status: string; changes?: string[]; cases?: Row[] }
    const rows = async () =>
      JSON.parse((await runCli(p.dir, ['compare', '--json'])).stdout).rows as Row[]
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    await writeFile(join(p.dir, 'reeval.config.ts'), config('capability(1, { blocking: true })'))

    assert.equal((await runCli(p.dir)).code, 0)
    const [same] = await rows()
    assert.deepEqual(
      [same?.status, same?.changes?.join()],
      ['same', 'gate changed'],
      'the gate names the change but leaves the eval comparable',
    )
    assert.deepEqual(
      same?.cases?.map((r) => [r.status, r.changes?.join()]),
      Array(6).fill(['same', 'gate changed']),
      'each case names the gate change and stays comparable',
    )
    const shown = await runCli(p.dir, ['compare', '--fail-on-regression'])
    assert.equal(shown.code, 0, `nothing regressed\n${shown.stdout}`)
    assert.match(
      shown.stdout,
      /^ {2}same {13}ada\n {4}gate +all → any {2}base would still pass under it$/m,
      'a gate change is named even where the outcome held',
    )

    // Canary: a pooled lift that falls below minLift is still a regression across the gate change.
    assert.equal((await runCli(p.dir, ['run'], { env: { REEVAL_TEST_BASE_OK: '1' } })).code, 1)
    const [family] = await rows()
    assert.equal(family?.status, 'regressed')
    assert.equal((await runCli(p.dir, ['compare', '--fail-on-regression'])).code, 1)
  })

  test('reeval compare has one row for an eval with cases without a gate, its cases inside it', async () => {
    const p = await gitProject('compare-family-ungated', {
      'evals/greets.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  cases: [{ key: 'ada' }, { key: 'grace' }],
  async task(c) {
    await c.send('go')
    assert.equal(process.env.REEVAL_TEST_BREAK ?? 'ok', 'ok')
  },
})
`,
    })
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    assert.equal((await runCli(p.dir, ['run'], { env: { REEVAL_TEST_BREAK: '1' } })).code, 1)
    const r = await runCli(p.dir, ['compare', '--json'])
    const rows = JSON.parse(r.stdout).rows as Array<{
      status: string
      cases?: Array<{ id: string; status: string }>
    }>
    assert.deepEqual(
      rows.map((x) => [x.status, x.cases?.map((k) => [k.id, k.status])]),
      [
        [
          'regressed',
          [
            ['ada', 'regressed'],
            ['grace', 'regressed'],
          ],
        ],
      ],
    )
  })

  test('runs of different cases compare over the cases both ran; a failing case only head ran fails --fail-on-regression', async () => {
    const p = await gitProject('compare-case-scope', {
      'evals/greets.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
const fail = (process.env.REEVAL_TEST_FAIL ?? '').split(',')
export default defineEval({
  cases: (process.env.REEVAL_TEST_SET ?? 'a,b,c').split(',').map((key) => ({ key })),
  async task(c, { key: k }) {
    await c.send('go')
    assert.equal(fail.includes(k), false, 'passes ' + k)
  },
})
`,
    })
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    const head = async (env: Record<string, string>) => {
      await runCli(p.dir, ['run'], { env })
      const json = await runCli(p.dir, ['compare', '--json'])
      const [row] = JSON.parse(json.stdout).rows as Array<{
        status: string
        head: string
        changes?: string[]
        caseScope?: { added: string[]; removed: string[] }
      }>
      const gate = await runCli(p.dir, ['compare', '--fail-on-regression'])
      return { row, code: gate.code, out: gate.stdout }
    }

    const swapped = await head({ REEVAL_TEST_SET: 'a,b,d' })
    assert.deepEqual(
      [swapped.row?.status, swapped.row?.caseScope, swapped.code],
      ['same', { added: ['d'], removed: ['c'] }, 0],
      swapped.out,
    )
    const added = await head({ REEVAL_TEST_SET: 'a,b,d', REEVAL_TEST_FAIL: 'd' })
    assert.deepEqual(
      [added.row?.status, added.row?.head, added.row?.changes, added.code],
      ['drift', 'fail', ['case d added'], 1],
      added.out,
    )
    const shared = await head({ REEVAL_TEST_SET: 'a,b,d', REEVAL_TEST_FAIL: 'b' })
    assert.deepEqual(
      [shared.row?.status, shared.row?.caseScope, shared.code],
      ['regressed', { added: ['d'], removed: ['c'] }, 1],
      shared.out,
    )
    const removed = await head({ REEVAL_TEST_SET: 'a,b' })
    assert.deepEqual(
      [removed.row?.status, removed.row?.caseScope, removed.code],
      ['same', { added: [], removed: ['c'] }, 0],
      removed.out,
    )
  })

  test("a change to one case's data is drift on that case and its eval's cells, not flakiness", async () => {
    const p = await gitProject('compare-case-drift', {
      'evals/fp.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
const bv = Number(process.env.REEVAL_TEST_BV ?? 1)
export default defineEval({
  cases: [{ key: 'a', v: 1 }, { key: 'b', v: bv }],
  async task(c, k) {
    await c.send('go')
    assert.ok(k.v < 3, 'small')
  },
})
`,
    })
    for (const bv of ['1', '2', '3']) {
      await runCli(p.dir, ['run', '--record'], { env: { REEVAL_TEST_BV: bv } })
    }
    const r = await runCli(p.dir, ['compare', '--json'])
    const [row] = JSON.parse(r.stdout).rows as Array<{
      status: string
      cases: Array<{ id: string; status: string }>
    }>
    assert.deepEqual(
      [row?.status, row?.cases.map((k) => [k.id, k.status])],
      [
        'drift',
        [
          ['a', 'same'],
          ['b', 'drift'],
        ],
      ],
      'a case whose data changed is drift, never regressed',
    )
    const drift = await query(
      p.dir,
      "SELECT changed FROM drift WHERE eval_key = 'fp' ORDER BY run_id",
    )
    assert.equal(drift.length, 2, 'each change to b moves the eval cell')
    for (const d of drift) assert.match(String(d.changed), /sources/)
    const flaky = await query(p.dir, "SELECT case_key, runs FROM flaky_cells WHERE case_key = 'b'")
    assert.ok(
      flaky.every((f) => Number(f.runs) === 1),
      `b is never pooled over runs whose data differ: ${JSON.stringify(flaky)}`,
    )
  })

  test('reeval compare reads an eval an interrupt canceled as canceled, never regressed', {
    skip: noSignals,
  }, async () => {
    const p = await gitProject('compare-canceled', {})
    const started = join(p.dir, 'slow.started')
    mkdirSync(join(p.dir, 'evals'))
    await writeFile(
      join(p.dir, 'evals/flips.eval.ts'),
      `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('write hello.txt')
    assert.equal(process.env.REEVAL_TEST_BREAK ?? 'ok', 'ok', 'returns ok')
  },
})
`,
    )
    await writeFile(
      join(p.dir, 'evals/slow.eval.ts'),
      `import { writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    if (process.env.REEVAL_TEST_SLOW) {
      writeFileSync(${JSON.stringify(started)}, '')
      await new Promise((_, reject) => c.signal.addEventListener('abort', () => reject(c.signal.reason)))
    }
    assert.equal(1, 1, 'finished')
  },
})
`,
    )
    sh(p.dir, 'add', '-A')
    sh(p.dir, 'commit', '-q', '-m', 'evals')
    assert.equal((await runCli(p.dir, ['run', '--record'])).code, 0)
    const compareCode = async (...args: string[]) => {
      const r = await runCli(p.dir, ['compare', ...args])
      return { code: r.code, out: r.stdout + r.stderr }
    }
    // One trial at a time, so `flips` has finished by the time `slow` starts waiting.
    const interrupted = async (env: Record<string, string>) => {
      await rm(started, { force: true })
      let pid = 0
      const run = runCli(p.dir, ['run', '--concurrency', '1'], {
        env: { REEVAL_TEST_SLOW: '1', ...env },
        onOutput: (_, id) => {
          pid = id
          return true
        },
      })
      while (!existsSync(started)) await new Promise((resolve) => setTimeout(resolve, 50))
      process.kill(pid, 'SIGINT')
      const r = await run
      assert.equal(r.code, 130, r.stdout + r.stderr)
    }

    await interrupted({})
    const canceled = await compareCode('--fail-on-regression')
    assert.match(
      canceled.out,
      /^can't compare {4}slow\n {2}base {13}\S+ {2}pass\n {2}head {13}\S+ {2}canceled$/m,
    )
    assert.doesNotMatch(canceled.out, /regressed/)
    assert.match(canceled.out, /^1 can't compare · 1 same$/m)
    assert.equal(canceled.code, 0, canceled.out)
    const row = JSON.parse((await compareCode('--json')).out).rows.find(
      (r: { id: string }) => r.id === 'slow',
    )
    assert.deepEqual([row.status, row.head, row.canceled], ['drift', 'fail', ['head']])

    // Canary: a real pass → fail in the same interrupted head still regresses and fails the check.
    await interrupted({ REEVAL_TEST_BREAK: '1' })
    const regressed = await compareCode('--fail-on-regression')
    assert.match(regressed.out, /^regressed {8}flips\n(.*\n){2} {2}error {12}returns ok\b/m)
    assert.match(regressed.out, /^can't compare {4}slow$/m)
    assert.match(regressed.out, /^1 regressed · 1 can't compare$/m)
    assert.equal(regressed.code, 1, regressed.out)
  })

  test("a turn's text is cut at 8 KB in the record; trajectory.jsonl keeps it whole", async () => {
    const long = 'x'.repeat(20_000)
    const p = await project('turn-cap', {
      'reeval.config.ts': fakeConfig({ harness: `{ text: '${long}' }` }),
      'evals/long.eval.ts': `import { defineEval } from 'reeval'\nexport default defineEval({ async task(c) { await c.send('x') } })\n`,
    })
    assert.equal((await runCli(p.dir)).code, 0)
    const [e] = readRun(p.dir).evals
    const text = e?.trial.turns[0]?.text ?? ''
    assert.ok(text.startsWith('x'.repeat(8 * 1024)) && !text.startsWith('x'.repeat(8 * 1024 + 1)))
    assert.match(text, /\[reeval: truncated 20000 characters;/)
    assert.ok(e?.read(e.trial.files.trajectory?.path ?? '').includes(long))
  })

  test('cells join environments by digest, not name; trials have keys', async () => {
    const p = await project('joins', {
      'reeval.config.ts': fakeConfig({ extra: 'concurrency: 1,' }),
      'evals/uses-one.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeSandbox } from 'reeval/sandbox'
const one = defineEnvironment('tools', { sandbox: fakeSandbox(), env: { FLAVOR: 'one' } })
export default defineEval({
  environment: one,
  trials: 3,
  graders: [judge('Is it fine?', { inputs: { diff: true } })],
  async task(c) {
    await c.send('x')
  },
})
`,
      'evals/uses-two.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'
const two = defineEnvironment('tools', { sandbox: fakeSandbox(), env: { FLAVOR: 'two' } })
export default defineEval({
  environment: two,
  async task(c) {
    await c.send('x')
  },
})
`,
      'evals/uses-none.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('x')
  },
})
`,
    })
    assert.equal((await runCli(p.dir)).code, 0)
    const { run } = readRun(p.dir)
    const cell = (name: string) => run.evals.find((e) => e.name === name)?.cells[0]
    for (const name of ['uses-one', 'uses-two']) {
      const c = cell(name)
      const byDigest = run.environments.filter((e) => e.digest === c?.environmentDigest)
      assert.equal(byDigest.length, 1, `${name} resolves to one environment`)
      assert.equal(run.environments.filter((e) => e.name === c?.environment).length, 2)
    }
    assert.notEqual(cell('uses-one')?.environmentDigest, cell('uses-two')?.environmentDigest)
    assert.equal(cell('uses-none')?.environment, 'fake')
    assert.ok(cell('uses-none')?.environmentDigest)
    assert.notEqual(cell('uses-none')?.environmentDigest, cell('uses-one')?.environmentDigest)
    assert.deepEqual([cell('uses-one')?.harnessKind, cell('uses-one')?.model], ['fake', null])

    const trials = run.evals.flatMap((e) => e.trials)
    assert.deepEqual(
      trials.map((a) => a.seq).sort((a, b) => (a ?? 0) - (b ?? 0)),
      [1, 2, 3, 4, 5],
      'concurrency 1: one start order across the run',
    )
    const one = run.evals.find((e) => e.name === 'uses-one')
    assert.deepEqual(
      one?.trials.map((a) => a.key),
      [1, 2, 3].map((n) => `${one?.key} # fake/tools/fake#${n}`),
    )
    assert.ok(trials.every((a) => a.startedAt && a.imageId === null))
    assert.equal(one?.trials[0]?.grades?.[0]?.grader, 'judge:Is it fine?')
    assert.equal('config' in run && 'harnesses' in run.config, false)
    assert.equal(run.runner.kind === 'local' || run.runner.pr !== undefined, true)
  })
})

describe('config discovery', () => {
  const passing = () => `import { defineEval } from 'reeval'
export default defineEval({ async task() {} })
`
  const wrongConfig = () => `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({ async task() { assert.equal('this config', 'never run') } })
`

  test('every command run from a nested subdirectory finds the project config and acts from its directory', async () => {
    const p = await gitProject('found-upward', {
      'reeval.config.ts': fakeConfig({
        harness: `{ id: process.env.REEVAL_T_WHERE ?? 'unset', files: { 'hello.txt': 'hi\\n' }, text: 'Wrote it' }`,
      }),
      'evals/agent.eval.ts': agent,
      // Decoys a run that resolved from the current directory would pick up.
      'src/deep/nested/evals/decoy.eval.ts': wrongConfig(),
      'src/deep/nested/marker.txt': 'here\n',
    })
    await writeFile(join(p.dir, '.env.local'), 'REEVAL_T_WHERE=root\n')
    await writeFile(join(p.dir, 'src/deep/nested/.env.local'), 'REEVAL_T_WHERE=cwd\n')
    const sub = join(p.dir, 'src/deep/nested')
    const config = '../../../reeval.config.ts'
    const ok = async (args: string[]) => {
      const r = await runCli(sub, args)
      assert.equal(r.code, 0, `reeval ${args.join(' ')}\n${r.stdout}${r.stderr}`)
      return r
    }

    const plan = await ok(['run', '--dry-run'])
    assert.match(plan.stdout, /^ {2}➜ {2}Config: +\.\.\/\.\.\/\.\.\/reeval\.config\.ts$/m)
    assert.doesNotMatch(plan.stdout, /decoy/)

    const run = await ok(['run', '-v'])
    assert.match(run.stdout, /^ {2}➜ {2}Config: +\.\.\/\.\.\/\.\.\/reeval\.config\.ts$/m)
    const first = readRun(p.dir).run
    assert.deepEqual(
      first.evals.flatMap((e) => e.trials.map((a) => `${e.id} ${a.id}`)),
      ['agent root/fake/fake#1'],
      "the config's .env.local, not the current directory's",
    )

    assert.match((await ok(['record'])).stdout, /^recorded \.\.\/\.\.\/\.\.\/evals\/\.history\//)
    assert.deepEqual(recordedRuns(p.dir), [first.runId])
    await ok(['run', '--record'])
    assert.equal(recordedRuns(p.dir).length, 2)
    const history = JSON.parse((await ok(['history', '--json'])).stdout)
    assert.deepEqual(
      history.rows.map((r: { id: string }) => r.id),
      ['agent'],
    )
    assert.equal(JSON.parse((await ok(['show', 'latest', '--json'])).stdout).kind, 'reeval-run')
    assert.match((await ok(['compare'])).stdout, /same/i)
    assert.deepEqual(JSON.parse((await ok(['query', 'failing_trials', '--json'])).stdout), [])
    assert.ok(existsSync(join(p.dir, '.reeval/history.db')))
    await ok(['explain', '--context'])
    assert.match(
      (await ok(['image', 'build', '--dry-run'])).stdout,
      /No eval runs in a Docker or Tart sandbox/,
      "the config's fake sandbox, not the default docker()",
    )
    assert.match(
      (await ok(['clean'])).stdout,
      / from \.\.\/\.\.\/\.\.\/\.reeval\/debug and \.reeval\/runs$/m,
    )

    assert.deepEqual(readdirSync(sub).sort(), ['.env.local', 'evals', 'marker.txt'])
    assert.equal((await ok(['run', '--dry-run', '--config', config])).code, 0)
  })

  test("a nested project's own config wins over the parent's, and --config wins over both", async () => {
    const p = await project('nearest-wins', {
      'reeval.config.ts': fakeConfig(),
      'evals/parent.eval.ts': wrongConfig(),
      'packages/app/reeval.config.mjs': fakeConfig(),
      'packages/app/evals/app.eval.ts': passing(),
      'packages/app/src/lib/index.ts': '',
    })
    const app = join(p.dir, 'packages/app')
    const lib = join(app, 'src/lib')

    const nested = await runCli(lib)
    assert.equal(nested.code, 0, nested.stdout + nested.stderr)
    assert.deepEqual(
      readRun(app).run.evals.map((e) => e.id),
      ['app'],
    )
    assert.equal(existsSync(join(p.dir, '.reeval')), false, "nothing under the parent's config")

    // Twin: the parent's config, found from its own tree or named with --config, runs its eval.
    const parent = await runCli(join(p.dir, 'evals'))
    assert.equal(parent.code, 1, parent.stdout + parent.stderr)
    assert.match(parent.stdout, /^└─ ✗ parent {2}mean 0% · 0\/1 trial at 100% {2}regression\(1\)$/m)
    const named = await runCli(lib, ['run', '--config', '../../../../reeval.config.ts'])
    assert.equal(named.code, 1, named.stdout + named.stderr)
    assert.deepEqual(
      readRun(p.dir).run.evals.map((e) => e.id),
      ['parent'],
    )
  })
})

describe('records from before a field existed', () => {
  const OLD = BEFORE_100
  const oldRun = '20260927T151935Z_facb81b_cursor-agent_07sv'
  const raw = (): RunRecord =>
    JSON.parse(readFileSync(join(testDir, OLD, HISTORY, `${oldRun}.json`), 'utf8'))

  test('the fixture predates plan.sandboxWarnings, harnesses[].resolvedModels and evals[].todo', () => {
    const r = raw()
    assert.equal('sandboxWarnings' in r.plan, false)
    assert.equal(
      r.stack.harnesses.some((h) => 'resolvedModels' in h),
      false,
    )
    assert.equal(
      r.evals.some((e) => 'todo' in e),
      false,
    )
  })

  test('plan.sandboxWarnings: a record without it reads as none, and summary.md renders', () => {
    const r = raw()
    assert.deepEqual(readableRecord(r).plan.sandboxWarnings, [])
    assert.doesNotMatch(renderSummary(readableRecord(raw())), /running as root/)
  })

  test('stack.harnesses[].effort: a record without it reads as unset, and Fast is not served effort', () => {
    const r = readableRecord(raw())
    assert.deepEqual(
      r.stack.harnesses.map((h) => [h.effort, h.resolvedEffort]),
      [[null, []]],
    )
    assert.deepEqual(
      r.evals[0]?.cells.map((c) => c.effort),
      r.evals[0]?.cells.map(() => null),
    )
    assert.deepEqual(
      r.evals[0]?.trials.map((a) => [a.effort, a.servedEffort]),
      r.evals[0]?.trials.map(() => [null, null]),
    )
  })

  test('stack.harnesses[].resolvedModels: a record without it reads as none, and the harness label renders', () => {
    const r = readableRecord(raw())
    assert.deepEqual(
      r.stack.harnesses.map((h) => h.resolvedModels),
      [[]],
    )
    assert.equal(
      harnessLabel(r.stack.harnesses[0] as RunRecord['stack']['harnesses'][number]),
      'fake',
    )
  })

  test('stack.runtime and stack.language: a record without them ran on Node, and names no language', () => {
    const r = readableRecord(raw())
    assert.equal('runtime' in r.stack || 'language' in r.stack, false)
    assert.equal(runtimeLabel(r.stack), `node ${r.stack.node}`)
    assert.equal(languageLabel(r.stack), null)
    assert.match(renderSummary(r), new RegExp(`\\| reeval \\| \\S+ · node ${r.stack.node} · \\w+/`))
  })

  test('the runtime and language labels', () => {
    const bun = { node: '26.3.0', runtime: { name: 'bun', version: '1.4.2' } }
    assert.equal(runtimeLabel(bun), 'bun 1.4.2 (node 26.3.0)')
    assert.equal(
      runtimeLabel({ node: '22.14.0', runtime: { name: 'node', version: '22.14.0' } }),
      'node 22.14.0',
    )
    assert.equal(languageLabel({ language: { name: 'typescript' } }), 'typescript evals')
    assert.equal(
      languageLabel({ language: { name: 'dart', version: '3.13.5' } }),
      'dart 3.13.5 evals',
    )
  })

  test('evals[].todo: a record without it reads as not todo, and summary.md renders', () => {
    const r = readableRecord(raw())
    assert.deepEqual(
      r.evals.map((e) => e.todo),
      [false, false],
    )
    assert.match(renderSummary(r), /writes greet\.js/)
  })

  test('a newer record keeps what it has', () => {
    const r = raw()
    r.plan.sandboxWarnings = [
      { kind: 'root', level: 'config', where: 'reeval.config.ts', file: null, message: 'm' },
    ]
    r.evals[1] = { ...(r.evals[1] as RunRecord['evals'][number]), todo: true }
    const read = readableRecord(r)
    assert.equal(read.plan.sandboxWarnings.length, 1)
    assert.equal(read.evals[1]?.todo, true)
  })

  test('reeval show, show --md, history, query and compare read it next to a new run', async () => {
    const p = await fixture(OLD)
    await portBefore100(p.dir)
    const ok = async (args: string[]) => {
      const r = await runCli(p.dir, args)
      assert.equal(r.code, 0, `reeval ${args.join(' ')}\n${r.stdout}${r.stderr}`)
      return r.stdout
    }
    assert.match(await ok(['show', oldRun]), /writes greet\.js/)
    assert.match(await ok(['show', oldRun, '--md']), /^# Run 20260927T151935Z_/m)
    assert.match(await ok(['show', oldRun, '--json']), /"sandboxWarnings": \[\]/)
    await ok(['run', '--record', '--ui', 'plain'])
    const runs = recordedRuns(p.dir)
    assert.equal(runs.length, 2)
    assert.match(await ok(['history']), /writes greet\.js/)
    assert.match(await ok(['query', 'select count(*) as n from evals']), /^n\n4$/m)
    assert.match(await ok(['query', 'eval_trend']), /writes greet\.js/)
    assert.match(
      await ok(['compare', oldRun, runs[1] as string]),
      /^(\d+ (regressed|fixed|can't compare|infra error|new|removed|same)( · )?)+$/m,
    )
  })
})

describe('records from a newer reeval', () => {
  const OLD = BEFORE_100
  const oldRun = '20260927T151935Z_facb81b_cursor-agent_07sv'
  const newRun = '20270101T000000Z_facb81b_cursor-agent_zz01'

  /** Writes a copy of the old run, at this reeval's version, as `newRun`, changed by `edit`, with its artifacts. */
  async function future(dir: string, edit: (r: Record<string, unknown>) => void) {
    const history = join(dir, HISTORY)
    let r = JSON.parse(readFileSync(join(history, `${oldRun}.json`), 'utf8'))
    for (const [from, migrate] of Object.entries(MIGRATIONS['run-record'] ?? {})) {
      if (r.schemaVersion === Number(from)) r = (migrate as (v: unknown) => typeof r)(r)
    }
    r.runId = newRun
    edit(r)
    await writeFile(join(history, `${newRun}.json`), JSON.stringify(r, null, 2))
    execFileSync('cp', ['-R', join(history, oldRun), join(history, newRun)])
  }

  test('a newer schemaVersion: reeval show says to upgrade reeval, and the other readers skip it with a warning', async () => {
    const p = await fixture(OLD)
    await portBefore100(p.dir)
    await future(p.dir, (r) => {
      r.schemaVersion = 4
    })
    const upgrade =
      /written by a newer reeval \(schemaVersion 4; this reeval reads up to 3\)\. Upgrade reeval to read it\./
    const shown = await runCli(p.dir, ['show', newRun])
    assert.notEqual(shown.code, 0, shown.stdout + shown.stderr)
    assert.match(shown.stderr, upgrade)
    for (const args of [['history'], ['query', 'select count(*) as n from runs']]) {
      const r = await runCli(p.dir, args)
      assert.equal(r.code, 0, `reeval ${args.join(' ')}\n${r.stdout}${r.stderr}`)
      assert.match(r.stderr, new RegExp(`skipped ${HISTORY}/${newRun}\\.json: ${upgrade.source}`))
      assert.doesNotMatch(r.stderr, /Restore it from git/)
    }
    assert.match(
      (await runCli(p.dir, ['query', 'select count(*) as n from runs'])).stdout,
      /^n\n1$/m,
    )
    const compared = await runCli(p.dir, ['compare', oldRun, newRun])
    assert.notEqual(compared.code, 0)
    assert.match(compared.stderr, upgrade)
  })

  test('fields, values and trajectory events a newer reeval added are ignored by every reader', async () => {
    const p = await fixture(OLD)
    await portBefore100(p.dir)
    const schema = JSON.parse(
      readFileSync(join(testDir, '../schema/run-record.schema.json'), 'utf8'),
    )
    await future(p.dir, (r) => {
      withUnknownFields(schema, r, () => ({ by: 'a newer reeval', list: [1] }))
      const record = r as unknown as RunRecord
      record.status = 'paused' as RunRecord['status']
      const trial = record.evals[0]?.trials[0] as RunRecord['evals'][number]['trials'][number]
      trial.outcome = 'canceled' as typeof trial.outcome
      trial.error = { kind: 'quota' as never, message: 'a kind this reeval does not know' }
      trial.turns[0] = {
        ...(trial.turns[0] as (typeof trial.turns)[number]),
        status: 'paused' as never,
      }
    })
    const trajectories = execFileSync(
      'find',
      [join(p.dir, HISTORY, newRun), '-name', 'transcript.jsonl'],
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')
    for (const t of trajectories) {
      await appendFile(
        t,
        `${JSON.stringify({ turn: 1, ts: '2027-01-01T00:00:00.000Z', atMs: 1, type: 'hologram', frames: 3 })}\n`,
      )
    }
    for (const args of [
      ['show', newRun],
      ['show', newRun, '--json'],
      ['show', newRun, '--md'],
      ['history'],
      ['history', '--json'],
      ['query', 'eval_trend'],
      ['query', 'select count(*) as n from tool_calls'],
      ['compare', oldRun, newRun],
    ]) {
      const r = await runCli(p.dir, args)
      assert.ok(
        r.code === 0 || (args[0] === 'compare' && r.code === 1),
        `reeval ${args.join(' ')}\n${r.stdout}${r.stderr}`,
      )
      assert.doesNotMatch(
        r.stderr,
        /TypeError|Cannot read|undefined is not|skipped/,
        `reeval ${args.join(' ')}\n${r.stderr}`,
      )
    }
    await writeStudioResponses(
      { root: p.dir, historyDir: join(p.dir, HISTORY), scratch: false },
      join(p.dir, 'site'),
    )
  })
})

describe('caches another reeval wrote', () => {
  test('.reeval/history-cache.json from another reeval version is rebuilt, even at the same mtime', async () => {
    const p = await fixture(BEFORE_100)
    await portBefore100(p.dir)
    assert.equal((await runCli(p.dir, ['history'])).code, 0)
    const file = join(p.dir, '.reeval/history-cache.json')
    const cache = JSON.parse(readFileSync(file, 'utf8'))
    for (const hit of Object.values(cache.files) as Array<{ entry: { author: string } }>) {
      hit.entry.author = 'from-a-stale-cache'
    }
    await writeFile(file, JSON.stringify(cache))
    assert.match((await runCli(p.dir, ['history', '--json'])).stdout, /from-a-stale-cache/)
    // npm installs every file with the same mtime, so only the version tells two releases apart.
    cache.build = cache.build.replace(/^[^:]+:/, '0.0.0-older:')
    await writeFile(file, JSON.stringify(cache))
    const r = await runCli(p.dir, ['history', '--json'])
    assert.equal(r.code, 0, r.stderr)
    assert.doesNotMatch(r.stdout, /from-a-stale-cache/)
  })
})

describe('history recorded with evaluate.each by reeval 0.18', () => {
  const OLD = 'fixtures/records/before-plural-keys'
  const oldRun = '20261103T125317Z_8cab9fc_cursor-agent_cpnp'
  const raw = (): RunRecord =>
    JSON.parse(readFileSync(join(testDir, OLD, HISTORY, `${oldRun}.json`), 'utf8'))
  const plain = defineEnvironment('plain', { sandbox: fakeSandbox() })
  const withSkill = defineEnvironment('with-skill', { sandbox: fakeSandbox() })
  const app = defineEnvironment('app', { sandbox: fakeSandbox() })

  test('the fixture names its family from a template, and a case key holds a slash', () => {
    const r = raw()
    assert.deepEqual(
      r.evals.map((e) => [e.name, e.family?.name]),
      [
        ['discovery: add user authentication', 'discovery: %s'],
        ['discovery: add social login and email/password auth', 'discovery: %s'],
        ['writes greet.js', undefined],
      ],
    )
  })

  test('a template family reads under its file and the name its template drops placeholders from', () => {
    const [family] = readableRecord(raw()).evals
    assert.deepEqual(
      [family?.id, family?.name, family?.cases?.map((c) => c.key)],
      [
        'evals/discovery.eval.ts › discovery',
        'discovery: %s',
        ['add user authentication', 'add social login and email/password auth'],
      ],
    )
    // Twin: the trials keep the case they ran as, under the eval's new name.
    assert.deepEqual(
      [...new Set(family?.trials.map((a) => a.case))],
      ['add user authentication', 'add social login and email/password auth'],
    )
  })

  test("a template's name drops its placeholders and the separators at its ends", () => {
    for (const [template, name] of [
      ['discovery: %s', 'discovery'],
      ['greets %s', 'greets'],
      ['picks a database for $id', 'picks a database for'],
      ['%# – %s works', 'works'],
      ['fixes ($id)', 'fixes'],
      ['no placeholder', 'no placeholder'],
      ['%s', '%s'],
    ]) {
      assert.equal(templateName(template as string), name, template)
    }
  })

  test('a template family keeps its template when another eval in the record has the new name', () => {
    const r = raw()
    const other = r.evals[2] as RunRecord['evals'][number]
    r.evals.push({ ...other, id: 'evals/discovery.eval.ts › discovery', name: 'discovery' })
    const names = readableRecord(r).evals.map((e) => e.id)
    assert.deepEqual(names, [
      'evals/discovery.eval.ts › discovery: %s',
      'evals/options.eval.ts › renamed options › writes greet.js',
      'evals/discovery.eval.ts › discovery',
    ])
  })

  test("the port's options hash as 0.18 hashed its singular keys and compare.baseline", () => {
    const [discovery, , options] = raw().evals
    assert.equal(
      optionsHash([{ compare: { baseline: plain, variants: [withSkill] } }]),
      discovery?.source?.options,
    )
    assert.equal(
      optionsHash([{ agents: fakeAgent(), pin: ['agents'] }, { environments: [app] }]),
      options?.source?.options,
    )
    // Canary: an option that really changed still changes the hash.
    assert.notEqual(
      optionsHash([{ compare: { baseline: plain, variants: [withSkill], minLift: 0.2 } }]),
      discovery?.source?.options,
    )
  })

  test('reeval compare reads a one-eval-file port as new evals beside the 0.18 run', async () => {
    const CASES = ['add user authentication', 'add social login and email/password auth']
    const p = await fixture(OLD)
    await writeFile(join(p.dir, 'reeval.config.ts'), fakeConfig())
    await writeFile(
      join(p.dir, 'evals/discovery.eval.ts'),
      `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'

const plain = defineEnvironment('plain', { sandbox: fakeSandbox() })
const withSkill = defineEnvironment('with-skill', { sandbox: fakeSandbox() })

export default defineEval({
  cases: [{ key: 'add user authentication' }, { key: 'add social login and email/password auth' }],
  compare: { baseline: plain, variants: [withSkill] },
  async task(c, { key: prompt }) {
    await c.send(prompt)
    assert.notEqual(await c.readFile('greet.js'), null)
  },
})
`,
    )
    await writeFile(
      join(p.dir, 'evals/options.eval.ts'),
      `import assert from 'node:assert/strict'
import { defineEnvironment, defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

const app = defineEnvironment('app', { sandbox: fakeSandbox() })

export default defineEval({
  agents: fakeAgent(),
  pin: ['agents'],
  environment: app,
  async task(c) {
    await c.send('Write greet.js.')
    assert.notEqual(await c.readFile('greet.js'), null)
  },
})
`,
    )
    await writeFile(join(p.dir, '.gitignore'), '.reeval/\nnode_modules/\n')
    sh(p.dir, 'init', '-q', '-b', 'main')
    sh(p.dir, 'add', '-A')
    sh(p.dir, 'commit', '-q', '-m', 'port to cases')
    const rows = async (env: Record<string, string> = {}) => {
      const run = await runCli(p.dir, ['run', '--record'], { env })
      assert.equal(run.code, 1, run.stdout + run.stderr)
      const [head] = recordedRuns(p.dir)
        .filter((id) => id !== oldRun)
        .slice(-1)
      const r = await runCli(p.dir, ['compare', oldRun, head as string, '--json'])
      assert.equal(r.code, 0, r.stdout + r.stderr)
      return (
        JSON.parse(r.stdout).rows as Array<{
          id: string
          status: string
          changes?: string[]
          cases?: Array<{ id: string; status: string }>
        }>
      ).map((x) => [x.id, x.status, x.changes, x.cases?.map((k) => k.id)])
    }
    // A one-eval file's id is its path, so the port's evals are new and the 0.18 run's keep their ids.
    assert.deepEqual(await rows(), [
      ['discovery', 'added', undefined, CASES],
      ['options', 'added', undefined, undefined],
      ['evals/discovery.eval.ts › discovery', 'removed', undefined, CASES],
      [
        'evals/options.eval.ts › renamed options › writes greet.js',
        'removed',
        undefined,
        undefined,
      ],
    ])
  })
})

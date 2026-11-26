// Eval ids and case keys that hold a secret: masked wherever reeval writes or prints them,
// and collisions refused at plan time.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { readReportInputs } from '../src/history/report-inputs.ts'
import type { RunRecord } from '../src/history/types.ts'
import { readRun as readStudioRun } from '../src/studio/source.ts'
import { buildRunReport } from '../src/view/report/build.ts'
import { fakeConfig, project, readRun, recordedRuns, runCli } from './helpers.ts'

const KEYS = /sk-ant-|aaaaaaaaaa|bbbbbbbbbb|cccccccccc|dddddddddd/
const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' }).flatMap((p) => {
    const path = join(dir, p)
    return statSync(path).isFile() ? [`${path}\n${readFileSync(path, 'utf8')}`] : []
  })

describe('eval names that hold a secret', () => {
  test('are masked in the record, its files, the terminal and every view', async () => {
    const p = await project('masked-names', {
      'reeval.config.ts': fakeConfig(),
      'evals/case.eval.ts': `import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
const k = (c: string) => 'sk-ant-' + c.repeat(24)
export default defineEval({
  cases: [{ key: k('b') }],
  async task() { assert.equal(1, 2) },
})
`,
      'evals/migrates-pgfixture9-schema.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ async task() {} })
`,
    })
    const runs: string[] = []
    for (const _ of [1, 2]) {
      const run = await runCli(p.dir, ['run', '--record'])
      assert.equal(run.code, 1, run.stdout + run.stderr)
      runs.push(run.stdout + run.stderr)
    }
    const { run } = readRun(p.dir)
    assert.deepEqual(
      run.evals.flatMap((e) => e.cases ?? []).map((k) => k.key),
      ['[REDACTED]'],
    )
    const views: string[] = []
    for (const args of [
      ['run', '--dry-run'],
      ['show'],
      ['history'],
      ['compare'],
      ['query', 'select eval_key, key from attempts'],
      ['query', 'failing_attempts'],
    ] as const) {
      const out = await runCli(p.dir, [...args])
      assert.ok(out.code === 0 || out.code === 1, `${args.join(' ')}: ${out.stdout}${out.stderr}`)
      views.push(`reeval ${args.join(' ')}\n${out.stdout}${out.stderr}`)
    }
    const studio = { root: p.dir, historyDir: join(p.dir, 'evals/.history'), scratch: false }
    for (const id of recordedRuns(p.dir)) {
      const { record, dir } = (await readStudioRun(studio, id)) as {
        record: RunRecord
        dir: string
      }
      views.push(JSON.stringify(buildRunReport(record, await readReportInputs(join(dir, id)))))
    }
    const written = ['.reeval', 'evals/.history'].flatMap((d) => filesUnder(join(p.dir, d)))
    for (const text of [...runs, ...views, ...written]) {
      assert.doesNotMatch(text, KEYS, text.slice(0, 2000))
    }
  })

  test("an eval's case keys that mask to the same name are refused at plan time", async () => {
    const p = await project('masked-collide-cases', {
      'reeval.config.ts': fakeConfig(),
      'evals/e.eval.ts': `import { defineEval } from 'reeval'
const key = (c: string) => 'sk-ant-' + c.repeat(24)
export default defineEval({
  cases: [{ key: key('a') }, { key: key('b') }],
  async task() {},
})
`,
    })
    const run = await runCli(p.dir, ['run', '--dry-run'])
    const out = run.stdout + run.stderr
    assert.equal(run.code, 2, out)
    assert.match(
      out,
      /evals\/e\.eval\.ts case "\[REDACTED\]" names a secret, and its masked name is another case's in this eval: Give each case a key that holds no secret\./,
    )
    assert.doesNotMatch(out, KEYS)
  })

  test("a name masked by a variable's value has a plan note naming the variable", async () => {
    const p = await project('masked-by-env', {
      'reeval.config.ts': fakeConfig(),
      'evals/migrates-pgfixture9-schema.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ async task() {} })
`,
    })
    const env = { FIXTURE_DB_PASSWORD: 'pgfixture9' }
    const run = await runCli(p.dir, ['run', '--dry-run'], { env })
    const out = run.stdout + run.stderr
    assert.equal(run.code, 0, out)
    assert.match(out, /migrates-\[REDACTED\]-schema/)
    assert.match(out, /name masked: it holds the value of FIXTURE_DB_PASSWORD, so its id differs/)
    assert.doesNotMatch(out, /pgfixture9/)
    const plain = await runCli(p.dir, ['run', '--dry-run'])
    assert.equal(plain.code, 0, plain.stdout + plain.stderr)
    assert.match(plain.stdout, /migrates-pgfixture9-schema/)
    assert.doesNotMatch(plain.stdout, /name masked/)
  })

  test('a filter that holds a secret says names are masked; the masked name matches', async () => {
    const p = await project('masked-filter', {
      'reeval.config.ts': fakeConfig(),
      'evals/plain.eval.ts': `import { defineEval } from 'reeval'
export default defineEval({ cases: [{ key: 'sk-ant-${'a'.repeat(24)}' }], async task() {} })
`,
    })
    const refused = await runCli(p.dir, ['run', '--dry-run', `plain#sk-ant-${'a'.repeat(24)}`])
    const out = refused.stdout + refused.stderr
    assert.equal(refused.code, 2, out)
    assert.match(
      out,
      /Eval names are masked, so a filter that holds a secret can't match one: filter by the masked name \("plain#\[REDACTED\]"\)/,
    )
    assert.doesNotMatch(out, KEYS)
    const matched = await runCli(p.dir, ['run', '--dry-run', 'plain#[REDACTED]'])
    assert.equal(matched.code, 0, matched.stdout + matched.stderr)
    assert.match(matched.stdout, /1 eval · 1 cell · 1 attempt/)
  })

  test('a value declared with secret() in an id is refused at plan time, writing it nowhere', async () => {
    const value = 'hunter9hunter9xq'
    const uses = `import { defineEnvironment, defineEval } from 'reeval'
const db = defineEnvironment('db', ({ secret }) => ({ env: { DB_PASS: secret.fromEnv('DB_PASS') } }))
export default defineEval({ environment: db, async task() {} })
`
    const p = await project('masked-declared', {
      'reeval.config.ts': fakeConfig(),
      [`evals/uses-${value}.eval.ts`]: uses,
    })
    const env = { DB_PASS: value }
    for (const args of [['run', '--dry-run'], ['run']] as const) {
      const run = await runCli(p.dir, [...args], { env })
      const out = run.stdout + run.stderr
      assert.equal(run.code, 2, `${args.join(' ')}: ${out}`)
      assert.match(
        out,
        /names a secret declared with secret\(\): rename the file without the secret\./,
      )
      assert.doesNotMatch(out, /hunter9/)
    }
    const reeval = join(p.dir, '.reeval')
    for (const text of existsSync(reeval) ? filesUnder(reeval) : []) {
      assert.doesNotMatch(text, /hunter9/)
    }
  })

  test("a case key that holds a secret is masked in the case's name, the notes and where's exclusions", async () => {
    const value = 'abcd1234efgh5678ijkl'
    const p = await project('masked-case-key', {
      'reeval.config.ts': fakeConfig(),
      'evals/keys.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
const a = defineEnvironment('a-env', { traits: { stack: 'a' } })
const b = defineEnvironment('b-env', { traits: { stack: 'b' } })
export default defineEval({
  environment: [a, b],
  cases: [{ key: 'k ${value}', stack: 'a' }, { key: 'plain', stack: 'b' }],
  where: ({ case: c, environment }) => environment.traits.stack === c.stack,
  async task() {},
})
`,
    })
    const env = { MY_API_TOKEN: value }
    const dry = await runCli(p.dir, ['run', '--dry-run', '--json'], { env })
    assert.equal(dry.code, 0, dry.stdout + dry.stderr)
    assert.match(dry.stdout, /name masked: it holds the value of MY_API_TOKEN/)
    const run = await runCli(p.dir, ['run', '--record'], { env })
    assert.equal(run.code, 0, run.stdout + run.stderr)
    const { run: record } = readRun(p.dir)
    assert.deepEqual(
      record.evals.map((e) => [e.id, e.cases?.map((k) => k.key)]),
      [['keys', ['k [REDACTED]', 'plain']]],
    )
    const excluded = record.evals.flatMap((e) => e.excluded ?? []).map((e) => e.case)
    assert.deepEqual(excluded.sort(), ['k [REDACTED]', 'plain'])
    const written = ['.reeval', 'evals/.history'].flatMap((d) => filesUnder(join(p.dir, d)))
    for (const text of [dry.stdout, dry.stderr, run.stdout, run.stderr, ...written]) {
      assert.doesNotMatch(text, /abcd1234|efgh5678/, text.slice(0, 2000))
    }
  })

  test('a case key that holds a value declared with secret() is refused at plan time', async () => {
    const value = 'hunter9hunter9xq'
    const p = await project('masked-case-declared', {
      'reeval.config.ts': fakeConfig(),
      'evals/uses.eval.ts': `import { defineEnvironment, defineEval } from 'reeval'
const db = defineEnvironment('db', ({ secret }) => ({ env: { DB_PASS: secret.fromEnv('DB_PASS') } }))
export default defineEval({ environment: db, cases: [{ key: '${value}' }, { key: 'plain' }], async task() {} })
`,
    })
    const run = await runCli(p.dir, ['run'], { env: { DB_PASS: value } })
    const out = run.stdout + run.stderr
    assert.equal(run.code, 2, out)
    assert.match(out, /uses#\[REDACTED\] names a secret declared with secret\(\)/)
    assert.doesNotMatch(out, /hunter9/)
    const reeval = join(p.dir, '.reeval')
    for (const text of existsSync(reeval) ? filesUnder(reeval) : []) {
      assert.doesNotMatch(text, /hunter9/)
    }
  })
})

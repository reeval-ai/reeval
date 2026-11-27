// `c.decide` end to end on the fake harness: what a recorded trial keeps of its calls, and a
// call the decide timeout or the trial's own timeout cuts off.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { readStoredTrial } from '../src/history/stored-trial.ts'
import type { TrialRecord } from '../src/history/types.ts'
import { fakeConfig, project, readRun, runCli } from './helpers.ts'

const SECRET = `ghp_${'a1B2'.repeat(9)}`

/** A decision model that answers only when its call is aborted, with the abort's reason. */
const HANGING = `{
  specificationVersion: 'v4',
  provider: 'fake',
  modelId: 'hanging',
  supportedQuestionTypes: ['boolean'],
  doDecide: ({ abortSignal }) =>
    new Promise((_, reject) => abortSignal?.addEventListener('abort', () => reject(abortSignal.reason))),
}`

const evalFile = (model: string, options = '') => `
import { defineEval } from 'reeval'
import { fakeDecisionModel } from 'reeval/testing'
const questions = { done: { type: 'boolean', instructions: 'Did the agent write the app?' } }
export default defineEval({
  ${options}
  async task(c) {
    await c.send('go')
    await c.decide({ model: ${model}, state: c.state({ output: true }), questions })
  },
})
`

const decisionLines = (dir: string, trial: TrialRecord) => {
  const ref = trial.files.decisions
  assert.ok(ref, 'files.decisions')
  return readFileSync(join(dir, ref.path), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
}

describe('c.decide', () => {
  test('what a passing trial stored has its decisions, the answers masked', async () => {
    const p = await project('decide-stored', {
      'reeval.config.ts': fakeConfig(),
      'evals/a.eval.ts': evalFile(
        `fakeDecisionModel({ done: { type: 'boolean', probability: 0.9, note: '${SECRET}' } })`,
      ),
    })
    const ran = await runCli(p.dir, ['run'])
    assert.equal(ran.code, 0, ran.stdout + ran.stderr)
    const recorded = await runCli(p.dir, ['record', 'latest'])
    assert.equal(recorded.code, 0, recorded.stdout + recorded.stderr)
    const { dir, evals } = readRun(p.dir, { history: 'evals/.history' })
    const trial = evals[0]?.trial as TrialRecord
    assert.equal(trial.outcome, 'pass')
    assert.equal(trial.files.trajectory, undefined, 'a passing trial keeps no trajectory')
    const t = await readStoredTrial(dir, trial)
    assert.equal(t.decisions.length, 1)
    assert.equal(t.decisions[0]?.model, 'fake/fake-decision')
    assert.equal(t.decisions[0]?.answers.done?.type, 'boolean')
    const stored = readFileSync(join(dir, trial.files.decisions?.path ?? ''), 'utf8')
    assert.match(stored, /"note":"/)
    assert.ok(!stored.includes(SECRET), 'the answers are masked')
  })

  test('decide.timeout fails a call the model never answers as an infra error', async () => {
    const p = await project('decide-timeout', {
      'reeval.config.ts': fakeConfig({ extra: "decide: { timeout: '50ms' }," }),
      'evals/a.eval.ts': evalFile(HANGING),
    })
    const ran = await runCli(p.dir, ['run'])
    const { dir, evals } = readRun(p.dir)
    const trial = evals[0]?.trial as TrialRecord
    assert.equal(trial.outcome, 'infra_error', ran.stdout + ran.stderr)
    assert.match(
      trial.error?.message ?? '',
      /^c\.decide\(\) with fake\/hanging timed out after 50ms\. Set decide\.model/,
    )
    assert.deepEqual(
      decisionLines(dir, trial).map((d) => [d.answers, d.error]),
      [[{}, 'timed out after 50ms']],
    )
  })

  test("the trial's timeout aborts a call in flight, which the record keeps", async () => {
    const p = await project('decide-abort', {
      'reeval.config.ts': fakeConfig(),
      'evals/a.eval.ts': evalFile(HANGING, "timeout: '1s',"),
    })
    const ran = await runCli(p.dir, ['run'])
    const { dir, evals } = readRun(p.dir)
    const trial = evals[0]?.trial as TrialRecord
    assert.equal(trial.outcome, 'fail', ran.stdout + ran.stderr)
    assert.match(trial.error?.message ?? '', /timed out/)
    assert.deepEqual(
      decisionLines(dir, trial).map((d) => [d.answers, d.error]),
      [[{}, 'the trial timed out or was canceled']],
    )
  })

  test("refuses a choice question without its options before the model's asked", async () => {
    const p = await project('decide-criteria', {
      'reeval.config.ts': fakeConfig(),
      'evals/a.eval.ts': `
import { defineEval } from 'reeval'
import { fakeDecisionModel } from 'reeval/testing'
export default defineEval({
  async task(c) {
    await c.send('go')
    await c.decide({
      model: fakeDecisionModel({}),
      state: 'x',
      questions: { pick: { type: 'choice', instructions: 'Which?' } },
    })
  },
})
`,
    })
    const ran = await runCli(p.dir, ['run'])
    const { evals } = readRun(p.dir)
    const trial = evals[0]?.trial as TrialRecord
    assert.equal(trial.outcome, 'fail', ran.stdout + ran.stderr)
    assert.match(
      trial.error?.message ?? '',
      /c\.decide\(\) question "pick" is a choice, so its criteria are an option map/,
    )
    assert.equal(trial.decisionUse, undefined, 'nothing was asked')
  })

  test("a call's own model the run has no key for fails the trial even when caught", async () => {
    const p = await project('decide-no-key', {
      'reeval.config.ts': fakeConfig(),
      'evals/a.eval.ts': `
import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
export default defineEval({
  async task(c) {
    await c.send('go')
    const questions = { done: { type: 'boolean', instructions: 'Done?' } }
    const caught = await c
      .decide({ model: 'anthropic/claude-haiku-4-5', state: 'x', questions })
      .then(() => null, (error) => error.name)
    assert.equal(caught, 'UsageError')
  },
})
`,
    })
    const ran = await runCli(p.dir, ['run'], {
      env: { ANTHROPIC_API_KEY: '', AI_GATEWAY_API_KEY: '' },
    })
    const { evals } = readRun(p.dir)
    const trial = evals[0]?.trial as TrialRecord
    assert.equal(trial.outcome, 'fail', ran.stdout + ran.stderr)
    assert.match(
      trial.error?.message ?? '',
      /No credentials for decide model "anthropic\/claude-haiku-4-5"/,
    )
    assert.equal(trial.decisionUse, undefined, 'nothing was asked')
  })

  test("an invalid-argument error from the provider is the provider's, and keeps the call", async () => {
    const p = await project('decide-provider-invalid', {
      'reeval.config.ts': fakeConfig(),
      'evals/a.eval.ts': evalFile(`{
  specificationVersion: 'v4',
  provider: 'fake',
  modelId: 'picky',
  supportedQuestionTypes: ['boolean'],
  doDecide: async () => {
    throw Object.assign(new Error('Invalid argument for parameter seed: too large'), {
      [Symbol.for('vercel.ai.error.AI_InvalidArgumentError')]: true,
    })
  },
}`),
    })
    const ran = await runCli(p.dir, ['run'])
    const { dir, evals } = readRun(p.dir)
    const trial = evals[0]?.trial as TrialRecord
    assert.equal(trial.outcome, 'infra_error', ran.stdout + ran.stderr)
    assert.match(
      trial.error?.message ?? '',
      /^c\.decide\(\) with fake\/picky failed: Invalid argument/,
    )
    assert.equal(decisionLines(dir, trial).length, 1)
  })
})

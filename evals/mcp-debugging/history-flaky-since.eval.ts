import { defineEval, expect } from 'reeval'
import { history, named, parseAnswer, study, toolkit, touchedRecords } from './debugging.ts'

export default defineEval({
  ...study('flaky-since', toolkit),
  task: async (c) => {
    await c.send(`${history}

One eval has started failing intermittently. Find which eval, the commit that made it flaky, and whether the flakiness is in the eval's check or in the agent's work. Don't change any files.

Write answer.json: {"eval": "<eval name>", "commit": "<its sha>", "cause": "<check or agent>"}.`)

    const answer = parseAnswer(await c.readFile('answer.json'))
    expect(named([answer.eval], ['builds the report']), 'names the eval').toHaveLength(1)
    const truth = await c.exec(`git log --format=%H --grep='^update evals (batch 5)$'`)
    const given = await c.exec(
      `git rev-parse --verify --quiet '${String(answer.commit ?? '')}^{commit}'`,
    )
    expect(given.stdout.trim(), 'names the commit').toBe(truth.stdout.trim())
    expect(answer.cause, 'names the cause').toBe('check')
    expect(await touchedRecords(c), 'leaves the history alone').toEqual([])
  },
})

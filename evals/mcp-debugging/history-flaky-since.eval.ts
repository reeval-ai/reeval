import { defineEval, defineGrader } from 'reeval'
import { observed } from 'reeval/graders'
import {
  answer,
  history,
  leavesHistory,
  named,
  observeHistory,
  parseAnswer,
  study,
  toolkit,
} from './debugging.ts'

export default defineEval({
  ...study('flaky-since', toolkit),
  graders: [
    defineGrader('names-the-eval', {
      files: ['answer.json'],
      grade: (c) => answer(c, 'eval'),
      score: (given) => (named([given], ['builds the report']).length === 1 ? 1 : 0),
    }),
    observed<{ flaky: string; named: string }>('commits', (c) => c.named === c.flaky, {
      name: 'names-the-commit',
    }),
    defineGrader('names-the-cause', {
      files: ['answer.json'],
      grade: (c) => answer(c, 'cause'),
      score: (given) => (given === 'check' ? 1 : 0),
    }),
    leavesHistory,
  ],
  task: async (c) => {
    await c.send(`${history}

One eval has started failing intermittently. Find which eval, the commit that made it flaky, and whether the flakiness is in the eval's check or in the agent's work. Don't change any files.

Write answer.json: {"eval": "<eval name>", "commit": "<its sha>", "cause": "<check or agent>"}.`)

    const given = parseAnswer(await c.readFile('answer.json'))
    const flaky = await c.exec(`git log --format=%H --grep='^update evals (batch 5)$'`)
    const named = await c.exec(
      `git rev-parse --verify --quiet '${String(given.commit ?? '')}^{commit}'`,
    )
    c.observe('commits', { flaky: flaky.stdout.trim(), named: named.stdout.trim() })
    await observeHistory(c)
  },
})

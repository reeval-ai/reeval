import { defineEval, expect } from 'reeval'
import { history, named, parseAnswer, study, toolkit, touchedRecords } from './debugging.ts'

export default defineEval({
  ...study('is-new', toolkit),
  task: async (c) => {
    await c.send(`${history}

The latest run failed. Which of its failing evals are failing for the first time in this history, and which failed in earlier runs too? Don't change any files.

Write answer.json: {"new": ["<eval name>", …], "old": ["<eval name>", …]}.`)

    const answer = parseAnswer(await c.readFile('answer.json'))
    const old = ['clamps a number', 'builds the report']
    expect(named(answer.new, ['title-cases a phrase', ...old]), 'finds the new failure').toEqual([
      'title-cases a phrase',
    ])
    expect(named(answer.old, old), 'finds the old failures').toEqual(old)
    expect(await touchedRecords(c), 'leaves the history alone').toEqual([])
  },
})

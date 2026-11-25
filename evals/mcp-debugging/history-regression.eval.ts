import { defineEval, expect } from 'reeval'
import { history, named, parseAnswer, study, toolkit, touchedRecords } from './debugging.ts'

export default defineEval({
  ...study('regression', toolkit),
  task: async (c) => {
    await c.send(`${history}

Compare the run recorded at the tag v1.2 with the latest run. Which evals regressed: passed at v1.2 and fail in the latest run? Don't change any files.

Write answer.json: {"regressed": ["<eval name>", …]}.`)

    const answer = parseAnswer(await c.readFile('answer.json'))
    const regressed = ['pads a string', 'removes duplicates']
    expect(named(answer.regressed, regressed), 'finds each regression').toEqual(regressed)
    expect(
      named(answer.regressed, ['clamps a number', 'chunks an array', 'sums a list']),
      'names nothing else',
    ).toEqual([])
    expect(await touchedRecords(c), 'leaves the history alone').toEqual([])
  },
})

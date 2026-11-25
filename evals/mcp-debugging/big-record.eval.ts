import { defineEval, expect } from 'reeval'
import { fixTask, parseAnswer, study, WEAKENED } from './debugging.ts'

export default defineEval({
  ...study('big-record', { base: 'catalog' }),
  task: async (c) => {
    await c.send(`${fixTask}\n\nIts runs are large: 82 attempts each.`)

    const answer = parseAnswer(await c.readFile('answer.json'))
    expect(answer.cause, 'names the cause').toBe('check-path')
    await expect(c.exec('node_modules/.bin/reeval run --ui plain'), 'reeval run passes').toSucceed()
    expect(c, 'leaves the agent under test alone').not.toHaveChanged(['reeval.config.ts'])
    const source = (await c.readFile('evals/export.eval.ts')) ?? ''
    const weakened = [
      ...[/toHaveFile\(\s*'lib\/export\.js'/, /c\.exec\(joinsRows\)/]
        .filter((keep) => !keep.test(source))
        .map(String),
      ...(source.match(WEAKENED) ?? []),
    ]
    expect(weakened, 'keeps the checks').toEqual([])
  },
})

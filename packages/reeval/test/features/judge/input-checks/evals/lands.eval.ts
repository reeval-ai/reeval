import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// checks: [command] shows only that command's results, as c.exec ran it.
export default defineEval({
  environment: app,
  graders: [
    judge('Did the second check pass?', {
      name: 'second-passed',
      inputs: { checks: ['echo second'] },
      model: fakeJudge({
        score: (s) => {
          const state = s as Record<string, unknown>
          return isDeepStrictEqual(state.checks, [
            { command: 'echo second', exitCode: 0, stdout: 'second\n', stderr: '' },
          ])
            ? 1
            : 0
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
    await c.exec('echo first')
    await c.exec('echo second')
  },
})

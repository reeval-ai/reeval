import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// turns: 'all' puts every turn up to the graded one under turns, oldest first.
export default defineEval({
  environment: app,
  graders: [
    judge('Did the agent keep the app from turn 1?', {
      name: 'kept-the-app',
      inputs: { task: true, turns: 'all' },
      model: fakeJudge({
        score: (s) => {
          const state = s as Record<string, unknown>
          return state.task === undefined &&
            isDeepStrictEqual(
              (state.turns as Array<{ task: string }>).map((t) => t.task),
              ['write the app', 'now add tests'],
            )
            ? 1
            : 0
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
    await c.send('now add tests')
  },
})

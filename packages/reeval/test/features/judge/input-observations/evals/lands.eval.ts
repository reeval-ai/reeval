import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// observations: [name] shows only that name's value, by name.
export default defineEval({
  environment: app,
  graders: [
    judge('Did it pick drizzle?', {
      name: 'picked-drizzle',
      inputs: { observations: ['orm'] },
      model: fakeJudge({
        score: (s) => {
          const state = s as Record<string, unknown>
          return isDeepStrictEqual(state.observations, { orm: 'drizzle' }) ? 1 : 0
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
    c.observe('orm', 'drizzle')
    c.observe('files', 1)
  },
})

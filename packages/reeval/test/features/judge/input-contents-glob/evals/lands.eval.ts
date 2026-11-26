import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// Patterns expand over the files git sees, in path order: the tests and the gitignored file
// are out, and docs/** matches nothing, so it adds nothing.
export default defineEval({
  environment: app,
  graders: [
    judge('Is the app tidy?', {
      name: 'tidy',
      inputs: { contents: ['src/**', '!**/*.test.ts', 'docs/**'] },
      model: fakeJudge({
        score: (s) => {
          const state = s as Record<string, unknown>
          return !String(state.diff).includes('export const twice') &&
            isDeepStrictEqual(Object.keys(state.contents ?? {}), ['src/app.ts', 'src/util.ts'])
            ? 1
            : 0
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
  },
})

import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

const want = [
  ['README.md', 'Run npm start\n'],
  ['missing.md', null],
  ['src/app.ts', 'export const app = () => "hello"\n'],
]

// contents shows each file whole as it is now: one the agent wrote, one it didn't touch,
// and one that isn't there.
export default defineEval({
  environment: app,
  graders: [
    judge('Does the README match the app?', {
      name: 'readme-matches',
      inputs: { contents: ['README.md', 'src/app.ts', 'missing.md'] },
      model: fakeJudge({
        score: (s) => {
          const state = s as Record<string, unknown>
          return !String(state.diff).includes('export const app') &&
            isDeepStrictEqual(Object.entries(state.contents ?? {}), want)
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

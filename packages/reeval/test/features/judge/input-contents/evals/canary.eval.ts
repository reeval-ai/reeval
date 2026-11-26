import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

const want = [
  ['README.md', 'Run npm test\n'],
  ['missing.md', null],
  ['src/app.ts', 'export const app = () => "hello"\n'],
]

// Must fail: the README is shown as it is, not as the eval guesses it.
export default defineEval({
  environment: app,
  graders: [
    judge('Does the README match the app?', {
      name: 'readme-matches',
      inputs: { contents: ['README.md', 'src/app.ts', 'missing.md'] },
      model: fakeJudge({
        // 0 only on the wrong value it's known to see; anything else errors the grader.
        score: (s) => {
          const saw = (s as Record<string, unknown>).contents
          if (
            isDeepStrictEqual(saw, {
              'README.md': 'Run npm start\n',
              'missing.md': null,
              'src/app.ts': 'export const app = () => "hello"\n',
            })
          )
            return 0
          throw new Error(`the judge saw ${JSON.stringify(saw)}`)
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
  },
})

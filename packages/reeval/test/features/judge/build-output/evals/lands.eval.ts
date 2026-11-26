import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

const want = [
  '[reeval: dropped dist/ (1 file): build output]',
  '[reeval: dropped public/vendor.js: minified, a line of 1616 characters]',
  '+export const app = () => "hello"',
]

// The judge's diff keeps the source and puts a marker in place of the build output and the
// minified bundle.
export default defineEval({
  environment: app,
  graders: [
    judge('Did the agent write the app?', {
      name: 'wrote-the-app',
      inputs: { diff: true },
      model: fakeJudge({
        score: (state) =>
          isDeepStrictEqual(
            String((state as Record<string, unknown>).diff).match(
              /^(?:\+export .*|\[reeval: .*\])$/gm,
            ),
            want,
          )
            ? 1
            : 0,
      }),
    }),
  ],
  task: async (c) => {
    await c.send('build the app')
  },
})

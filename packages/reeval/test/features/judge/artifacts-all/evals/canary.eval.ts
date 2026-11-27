import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { ui } from './env.ts'

const files = (state: unknown) =>
  (state as Array<{ type: string; mediaType?: string; data?: Uint8Array }>).filter(
    (p) => p.type === 'file',
  )

// Must fail: artifacts: true sends only the captures the trial took, and this one took one.
export default defineEval({
  environment: ui,
  graders: [
    judge('the form shows an error after a failed submit', {
      name: 'shows-the-error',
      inputs: { artifacts: true },
      model: fakeJudge({
        // 0 only on the wrong value it's known to see; anything else errors the grader.
        score: (s) => {
          const saw = files(s).map((p) => p.mediaType)
          if (isDeepStrictEqual(saw, ['image/png'])) return 0
          throw new Error(`the judge saw ${JSON.stringify(saw)}`)
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the form')
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'empty' })
  },
})

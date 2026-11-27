import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { ui } from './env.ts'

const files = (state: unknown) =>
  (state as Array<{ type: string; mediaType?: string; data?: Uint8Array }>).filter(
    (p) => p.type === 'file',
  )

// artifacts: true sends every capture the trial took, in the order it took them.
export default defineEval({
  environment: ui,
  graders: [
    judge('the form shows an error after a failed submit', {
      name: 'shows-the-error',
      inputs: { artifacts: true },
      model: fakeJudge({
        score: (state) =>
          isDeepStrictEqual(
            files(state).map((p) => p.mediaType),
            ['image/png', 'image/png'],
          )
            ? 1
            : 0,
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the form')
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'empty' })
    await c.capture(server, { name: 'filled' })
  },
})

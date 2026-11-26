import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { ui } from './env.ts'

const files = (state: unknown) =>
  (state as Array<{ type: string; mediaType?: string; data?: Uint8Array }>).filter(
    (p) => p.type === 'file',
  )

// The judge's decide state is a JSON part plus the capture as a file part.
export default defineEval({
  environment: ui,
  graders: [
    judge('the form shows an error after a failed submit', {
      name: 'shows-the-error',
      inputs: { artifacts: ['form'] },
      model: fakeJudge({
        score: (state) =>
          files(state).length === 1 &&
          files(state)[0]?.mediaType === 'image/png' &&
          (files(state)[0]?.data?.byteLength ?? 0) > 0
            ? 1
            : 0,
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the form')
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'form' })
  },
})

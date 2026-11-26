import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// trajectory: 'tools' shows the tool calls as text lines, with their output.
export default defineEval({
  environment: app,
  graders: [
    judge('Did the agent run the tests?', {
      name: 'ran-the-tests',
      inputs: { trajectory: 'tools' },
      model: fakeJudge({
        score: (s) => {
          const state = s as Record<string, unknown>
          return /^tool shell: npm test → ok.*\n {2}14 passing$/m.test(String(state.trajectory))
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

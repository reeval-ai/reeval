import { defineEval } from 'reeval'
import { withinLimits } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  graders: [
    withinLimits({ tokens: 1200, toolCalls: { bash: 2 }, duration: '5m' }),
    withinLimits({ toolCalls: 2 }, { name: 'tool-calls' }),
  ],
  task: async (c) => {
    await c.send('look around')
  },
})

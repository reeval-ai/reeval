import { defineEval } from 'reeval'
import { cost, duration, turns, withinLimits } from 'reeval/graders'
import { plain } from './env.ts'

// Usage against limits, and usage recorded; the config adds tokens and turns, and this turns
// replaces the config's.
export default defineEval({
  environment: plain,
  graders: [
    withinLimits(
      { tokens: 2400, toolCalls: { bash: 4 }, duration: '5m', cost: 0.05 },
      { required: true },
    ),
    turns({ score: (n) => (n <= 2 ? 1 : 0) }),
    cost(),
    duration(),
  ],
  task: async (c) => {
    await c.send('look around')
    await c.send('and again')
  },
})

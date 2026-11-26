import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

export default defineEval({
  graders: [hasFile('src/pad.js', 'padStart(', { name: 'pads-with-padStart' })],
  task: async (c) => {
    await c.send('Write src/pad.js: pad(s, n) pads s on the left to n characters.')
  },
})

import { defineEval, expect } from 'reeval'

export default defineEval({
  task: async (c) => {
    await c.send('Write src/pad.js: pad(s, n) pads s on the left to n characters.')
    expect(await c.readFile('src/pad.js'), 'pads with padStart').toContain('padStart(')
  },
})

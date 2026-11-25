import { defineEval, expect } from 'reeval'
import { baseline, variant } from './env.ts'

// artifacts: ['landing'] sends each side's landing capture as an image, and not aside.
export default defineEval({
  compare: { control: baseline, variants: [variant] },
  questions: [
    { question: 'Which page looks better?', across: 'environment', artifacts: ['landing'] },
  ],
  task: async (c) => {
    await c.send('write the page')
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'aside' })
    const landing = await c.capture(server, { name: 'landing' })
    expect(landing.file.path).toBe('artifacts/landing.png')
  },
})

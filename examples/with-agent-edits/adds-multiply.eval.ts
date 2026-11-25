import { readFileSync } from 'node:fs'
import { defineEnvironment, defineEval, expect } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

// A fake agent that always does the task right: if it fails, the eval is broken, not the agents.
const oracle = fakeAgent({
  id: 'oracle',
  files: { 'src/math.js': readFileSync(new URL('./oracle/src/math.js', import.meta.url), 'utf8') },
})

export default defineEval({
  environment: math,
  agents: { add: oracle },
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')

    await expect(c).toHaveFile('src/math.js', /export function multiply/)
    await expect(c.exec('node --test')).toSucceed()
  },
})

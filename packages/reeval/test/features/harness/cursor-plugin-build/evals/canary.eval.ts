import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { unbuilt } from './env.ts'

// Must fail: this build writes nothing, so the unpacked subagent is the source's placeholder.
export default defineEval({
  environment: unbuilt,
  graders: [
    observed<string | null>('.cursor/agents/reviewer.md', (text) => !!text?.includes('BUILT-41')),
  ],
  task: async (c) => {
    await c.exec('true')
    c.observe('.cursor/agents/reviewer.md', await c.readFile('.cursor/agents/reviewer.md'))
  },
})

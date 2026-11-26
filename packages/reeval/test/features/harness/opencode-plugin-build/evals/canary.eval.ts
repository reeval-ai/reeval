import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { unbuilt } from './env.ts'

// Must fail: this build writes nothing, so the unpacked subagent is the source's placeholder.
export default defineEval({
  environment: unbuilt,
  graders: [
    observed<string | null>('.opencode/agents/reviewer.md', (text) => !!text?.includes('BUILT-58')),
  ],
  task: async (c) => {
    await c.exec('true')
    c.observe('.opencode/agents/reviewer.md', await c.readFile('.opencode/agents/reviewer.md'))
  },
})

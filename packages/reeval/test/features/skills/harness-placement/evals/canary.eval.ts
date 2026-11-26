import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting, prompt, shellOutput } from './env.ts'

// Must fail: a harness-placed skill isn't also written into the workspace.
export default defineEval({
  environment: greeting,
  graders: [
    observed<string>('shell-output', (out) => out.includes('Greet people with "Ahoy, <name>!".')),
  ],
  task: async (c) => {
    const turn = await c.send(prompt)
    c.observe('shell-output', shellOutput(turn, 1))
  },
})

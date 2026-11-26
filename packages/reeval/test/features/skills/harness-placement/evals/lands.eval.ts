import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting, prompt, shellOutput } from './env.ts'

// A harness-placed skill is in the agent's home, where the Cursor adapter puts it.
export default defineEval({
  environment: greeting,
  graders: [
    observed<string>('shell-output', (out) => out.includes('Greet people with "Ahoy, <name>!".')),
  ],
  task: async (c) => {
    const turn = await c.send(prompt)
    c.observe('shell-output', shellOutput(turn, 0))
  },
})

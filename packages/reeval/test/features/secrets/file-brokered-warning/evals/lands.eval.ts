import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, keys } from './env.ts'

// A brokered secret's placeholder goes out where it isn't swapped in; the listener still answers.
export default defineEval({
  environment: keys,
  graders: [
    observed<string[]>(
      'agent-saw',
      ([prefix, body]) => prefix === 'reeval_secret_' && body === 'reeval-egress-ok',
    ),
  ],
  task: async (c) => {
    const [key, body] = agentSaw(await c.send('send the keys'))
    c.observe('agent-saw', [key?.slice(0, 14) ?? '', body ?? ''])
  },
})

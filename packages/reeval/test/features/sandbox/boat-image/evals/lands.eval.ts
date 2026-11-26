import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, closed } from './env.ts'

// The agent runs as reeval in a container of the recipe's image, and under deny-all its only way
// out is the gateway, which refuses the listener.
export default defineEval({
  environment: closed,
  graders: [
    observed<string[]>(
      'agent-saw',
      ([baked, user, direct = '', proxied]) =>
        baked === 'baked-by-boat-image' &&
        user === 'reeval' &&
        /^000 exit=[1-9]\d*$/.test(direct) &&
        proxied !== '200',
    ),
  ],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('where am I')))
  },
})

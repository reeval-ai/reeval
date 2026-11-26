import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, mac } from './env.ts'

// The bootstrap ran once, in the VM preflight baked, not in this attempt's clone of it.
export default defineEval({
  environment: mac,
  graders: [
    observed<string[]>(
      'agent-saw',
      ([where, vm = '']) =>
        where === 'baked' &&
        /^reeval-sandbox-fake-[0-9a-f]{8}-.*-bake-[0-9a-z]{8,}-[0-9a-f]{4}$/.test(vm),
    ),
  ],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('where was I installed')))
  },
})

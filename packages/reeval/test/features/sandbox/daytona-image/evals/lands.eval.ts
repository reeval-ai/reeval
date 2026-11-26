import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, vm } from './env.ts'

// The agent runs as its slot's user on the image's toolchain, with the install and the harness
// baked in: a slot's home is the image's copy, not an install of its own.
export default defineEval({
  environment: vm,
  graders: [
    observed<string[]>(
      'agent-saw',
      ([user = '', install, node, bootstrap]) =>
        /^reeval(-s1)?$/.test(user) &&
        install === 'installed' &&
        node === '/opt/reeval/node/bin/node' &&
        bootstrap === 'image',
    ),
  ],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('what is here')))
  },
})

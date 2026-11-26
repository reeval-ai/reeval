import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// As the agent: a file and a directory only it can read, as `mktemp` and `umask 077` make them.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    script: [
      [
        {
          exec: 'mkdir -m 700 private && echo key > private/key && echo token > .token && chmod 600 private/key .token',
        },
      ],
    ],
  }),
})

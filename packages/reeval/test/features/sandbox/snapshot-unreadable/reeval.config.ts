import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker only: the fake sandbox runs on the host as whoever runs reeval, who can read its state.
export default defineConfig({
  // As the agent: whether it can open the snapshot's HEAD.
  agents: fakeAgent({
    script: [
      [
        {
          exec: 'cat /var/lib/reeval/workspace.git/HEAD >/dev/null 2>&1 && echo read || echo refused',
        },
      ],
    ],
  }),
})

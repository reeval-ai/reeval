import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

const SECRET = `ghp_${'a1B2'.repeat(9)}`

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  agents: fakeAgent({
    script: [
      [
        {
          write: {
            '.gitignore': 'dist/\n',
            'src/app.js': 'export const answer = 42\n',
            'dist/bundle.js': 'built\n',
            'node_modules/dep/index.js': 'dep\n',
            '.env': `GITHUB_TOKEN=${SECRET}\n`,
            'bin/run.sh': '#!/bin/sh\necho hi\n',
          },
        },
        { exec: 'chmod +x bin/run.sh' },
      ],
    ],
  }),
})

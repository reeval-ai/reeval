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
            'src/app.js': 'export const answer = 42\n',
            '.env': `GITHUB_TOKEN=${SECRET}\n`,
          },
        },
      ],
    ],
  }),
})

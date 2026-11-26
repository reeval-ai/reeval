import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  agents: fakeAgent({
    script: [
      [
        {
          write: {
            'src/retry.ts': 'export function retry() {}\n',
            'node_modules/left-pad/index.js': 'module.exports = () => {}\n',
            'node_modules/left-pad/package.json': '{ "name": "left-pad" }\n',
          },
        },
      ],
    ],
  }),
})

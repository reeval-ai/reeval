import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    script: [
      [
        {
          write: {
            'src/add.js': 'export const add = (a, b) => a + b\n',
            'package.json': '{ "type": "module" }\n',
            'notes.txt': 'not for the grader\n',
          },
        },
      ],
    ],
  }),
})

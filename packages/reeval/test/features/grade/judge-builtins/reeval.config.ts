import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { turns } from 'reeval/graders'

export default defineConfig({
  target: regression(),
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
  graders: [turns()],
})

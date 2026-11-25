import { defineEval, expect } from 'reeval'
import { fixtureDir, listing } from './env.ts'

// The directory's files land at their paths, without the default ignores; nested build/ is kept.
export default defineEval({
  environment: fixtureDir,
  task: async (c) => {
    expect((await c.exec(listing)).stdout).toBe(
      './README.md\n./lib/build/tool.js\n./package.json\n./src/index.js\n',
    )
  },
})

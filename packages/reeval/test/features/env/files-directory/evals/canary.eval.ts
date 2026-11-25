import { defineEval, expect } from 'reeval'
import { fixtureDir, listing } from './env.ts'

// Must fail: node_modules/ and dist/ are default ignores, so they never land.
export default defineEval({
  environment: fixtureDir,
  task: async (c) => {
    expect((await c.exec(listing)).stdout).toBe(
      './README.md\n./dist/app.js\n./lib/build/tool.js\n./node_modules/dep/index.js\n./package.json\n./src/index.js\n',
    )
  },
})

import { defineEval } from 'reeval'
import { fixtureDir, listing, prints } from './env.ts'

// Must fail: node_modules/ and dist/ are default ignores, so they never land.
export default defineEval({
  environment: fixtureDir,
  graders: [
    prints(
      'lands-ignored',
      listing,
      './README.md\n./dist/app.js\n./lib/build/tool.js\n./node_modules/dep/index.js\n./package.json\n./src/index.js\n',
    ),
  ],
  task: async (c) => {
    await c.exec(listing)
  },
})

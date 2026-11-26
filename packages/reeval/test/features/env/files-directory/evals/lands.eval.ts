import { defineEval } from 'reeval'
import { fixtureDir, listing, prints } from './env.ts'

// The directory's files land at their paths, without the default ignores; nested build/ is kept.
export default defineEval({
  environment: fixtureDir,
  graders: [
    prints(
      'lands-files',
      listing,
      './README.md\n./lib/build/tool.js\n./package.json\n./src/index.js\n',
    ),
  ],
  task: async (c) => {
    await c.exec(listing)
  },
})

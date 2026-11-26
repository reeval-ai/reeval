import { defineEval } from 'reeval'
import { skillDirs } from '../layout.ts'
import { greeting, listing, skillFiles } from './env.ts'

// Must fail: the skill lands in the harness's own skill directory only.
export default defineEval({
  environment: greeting,
  graders: [skillFiles(skillDirs.not)],
  task: async (c) => {
    await c.exec(listing(skillDirs.not))
  },
})

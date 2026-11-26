import { defineEval } from 'reeval'
import { skillDirs } from '../layout.ts'
import { greeting, listing, skillFiles } from './env.ts'

// A workspace-placed skill lands in the repo skill directory the harness reads.
export default defineEval({
  environment: greeting,
  graders: [skillFiles(skillDirs.lands)],
  task: async (c) => {
    await c.exec(listing(skillDirs.lands))
  },
})

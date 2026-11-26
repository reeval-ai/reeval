import { defineEval, defineGrader } from 'reeval'
import { plain } from './env.ts'

const counted = defineGrader('subagents-counted', {
  grade: (c) => {
    const turn = c.turns[0]
    const spawn = turn?.transcript.find((e) => e.type === 'tool' && e.tool === 'Agent')
    const edit = turn?.transcript.find((e) => e.type === 'file-edit')
    return {
      edit: edit?.type === 'file-edit' ? edit.path : null,
      spawnedBy:
        edit?.type === 'file-edit' && spawn?.type === 'tool' && edit.subagent === spawn.toolCallId,
      input: turn?.usage?.input ?? null,
      output: turn?.usage?.output ?? null,
    }
  },
  score: (g) => (g.edit === 'add.js' && g.spawnedBy && g.input === 160 && g.output === 16 ? 1 : 0),
})

// The turn's tokens count both subagents', and the streamed one's edit names its spawn call.
export default defineEval({
  environment: plain,
  graders: [counted],
  task: async (c) => {
    await c.send('write add.js and mul.js with two subagents')
  },
})

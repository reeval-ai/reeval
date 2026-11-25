import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

// The turn's tokens count both subagents', and the streamed one's edit names its spawn call.
export default defineEval({
  environment: plain,
  task: async (c) => {
    const turn = await c.send('write add.js and mul.js with two subagents')
    const spawn = turn.transcript.find((e) => e.type === 'tool' && e.tool === 'Agent')
    const edit = turn.transcript.find((e) => e.type === 'file-edit')
    expect(edit).toMatchObject({
      path: 'add.js',
      subagent: spawn?.type === 'tool' && spawn.toolCallId,
    })
    expect(turn.usage).toMatchObject({ input: 160, output: 16 })
  },
})

import { defineEval, defineGrader } from 'reeval'
import { plain } from './env.ts'

const editPayload = defineGrader('edit-payload', {
  grade: (c) => {
    const edit = c.turns[0]?.trajectory.find((e) => e.type === 'file-edit') as
      | { input?: { path?: string; content?: string }; output?: string; outputView?: string }
      | undefined
    return edit
      ? {
          path: edit.input?.path ?? null,
          content: /^x{200000}\n$/.test(edit.input?.content ?? ''),
          output: edit.output ?? null,
          outputView: edit.outputView ?? null,
        }
      : null
  },
  score: (edit) =>
    edit?.path === 'big.txt' &&
    edit.content &&
    edit.output === 'Wrote big.txt' &&
    edit.outputView === 'model'
      ? 1
      : 0,
})

export default defineEval({
  environment: plain,
  graders: [editPayload],
  task: async (c) => {
    await c.send('write a big file')
  },
})

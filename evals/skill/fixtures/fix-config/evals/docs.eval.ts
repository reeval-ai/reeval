import { defineEval, expect } from 'reeval'
import { plain, withDocs } from './environments.ts'

export default defineEval({
  environment: [plain, withDocs],
  repeat: 3,
  task: async (c) => {
    await c.send('How do I page through GET /notes? Write the answer to answer.md.')
    expect(c, 'names the parameter').toHaveFile('answer.md', /limit/)
    const question = 'Does answer.md say how to page through /notes?'
    expect(await c.judge(question, { contents: ['answer.md'] })).toPass()
  },
})

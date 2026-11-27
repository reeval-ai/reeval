import { defineEval } from 'reeval'

export default defineEval({
  skip: true,
  task: async (c) => {
    await c.send('Write nothing.')
  },
})

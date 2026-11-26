import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

export default defineEval({
  graders: [
    hasFile('src/title-case.js', 'toUpperCase()', { name: 'upper-cases-each-first-letter' }),
  ],
  task: async (c) => {
    await c.send('Write src/title-case.js: titleCase(s) capitalizes each word.')
  },
})

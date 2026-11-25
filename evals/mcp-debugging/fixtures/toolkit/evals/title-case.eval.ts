import { defineEval, expect } from 'reeval'

export default defineEval({
  task: async (c) => {
    await c.send('Write src/title-case.js: titleCase(s) capitalizes each word.')
    expect(await c.readFile('src/title-case.js'), 'upper-cases each first letter').toContain(
      'toUpperCase()',
    )
  },
})

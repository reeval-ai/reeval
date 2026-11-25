import { defineEval, expect } from 'reeval'

export default defineEval({
  task: async (c) => {
    await c.send(
      'Write src/slug.js: slug(title) lower-cases a title and joins its words with dashes.',
    )
    expect(await c.readFile('src/slug.js'), 'replaces runs of other characters').toContain(
      'replace(',
    )
  },
})

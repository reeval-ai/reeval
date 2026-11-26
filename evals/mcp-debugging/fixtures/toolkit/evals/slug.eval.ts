import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

export default defineEval({
  graders: [hasFile('src/slug.js', 'replace(', { name: 'replaces-runs-of-other-characters' })],
  task: async (c) => {
    await c.send(
      'Write src/slug.js: slug(title) lower-cases a title and joins its words with dashes.',
    )
  },
})

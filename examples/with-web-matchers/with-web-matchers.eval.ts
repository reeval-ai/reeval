import { defineEval } from 'reeval'
import { fetched, hasFile, searched } from 'reeval/graders'

export default defineEval({
  graders: [
    searched(/parseArgs/i),
    fetched(/nodejs\.org/),
    hasFile('ANSWER.md', /18\.3\.0|16\.17\.0/),
  ],
  task: async (c) => {
    await c.send(
      'Search the web for the Node.js docs on util.parseArgs(), read the page, and write ' +
        'the Node.js version that added it in ANSWER.md.',
    )
  },
})

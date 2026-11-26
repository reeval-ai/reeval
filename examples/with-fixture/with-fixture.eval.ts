import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, notInDiff, succeeded } from 'reeval/graders'

// The package in ./project without its maintainer notes, a sample file from ./data, and a
// .gitignore, since the project's own isn't copied in.
const csv = defineEnvironment('csv', ({ directory, file }) => ({
  files: {
    ...directory('./project', { glob: ['!NOTES.md'] }),
    'data/people.csv': file('./data/people.csv'),
    '.gitignore': 'node_modules/\n',
  },
}))

export default defineEval({
  environment: csv,
  graders: [
    hasFile('src/csv.js', /export function stringifyCsv/),
    succeeded('node --test'),
    notInDiff('data/**', { name: 'leaves-the-data-alone' }),
  ],
  task: async (c) => {
    await c.send(
      'Add stringifyCsv(rows) to src/csv.js, the inverse of parseCsv, ' +
        'with a test that round-trips data/people.csv.',
    )
    await c.exec('node --test')
  },
})

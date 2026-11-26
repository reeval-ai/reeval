import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { hasFile, judge, succeeded } from 'reeval/graders'
import { wrote } from 'reeval/graders/match'

// The agent starts from ./project: a list of notes and nothing that pages it.
const notes = defineEnvironment('notes', ({ directory }) => ({ files: directory('./project') }))

// The second turn, the revision, edited src/notes.js.
const revised = defineGrader('revised-notes', {
  grade: (c) => wrote({ turns: c.turns.slice(1) }, 'src/notes.js').length > 0,
})

export default defineEval({
  environment: notes,
  graders: [
    revised,
    hasFile('src/notes.js', /nextCursor/, { required: true }),
    succeeded('node --test'),
    judge('Did the second turn do what the review asked, and keep the tests?', {
      inputs: { task: true, diff: true, turns: 'all' },
    }),
  ],
  task: async (c) => {
    await c.send(
      'Add listNotes() to src/notes.js: it returns the notes ten at a time. Add tests in ' +
        'test/notes.test.js.',
    )
    await c.send(
      'Review feedback: page by cursor, not by page number. listNotes({ cursor }) takes the id ' +
        'of the last note it returned and answers { notes, nextCursor }, with nextCursor null on ' +
        'the last page. Update the tests.',
    )
    await c.exec('node --test')
  },
})

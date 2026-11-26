import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, judge, succeeded } from 'reeval/graders'

// The agent starts from ./project, with the team's conventions seeded beside it in docs/.
const notes = defineEnvironment('notes', ({ directory, file }) => ({
  files: { ...directory('./project'), 'docs/conventions.md': file('./docs/conventions.md') },
}))

export default defineEval({
  environment: notes,
  graders: [
    hasFile('src/notes.js', /export function deleteNote/, { required: true }),
    succeeded('node --test'),
    judge('Does deleteNote, and its tests, follow every rule in docs/conventions.md?', {
      inputs: { contents: ['src/notes.js', 'test/notes.test.js', 'docs/**'] },
    }),
  ],
  task: async (c) => {
    await c.send('Add a deleteNote(id) handler to src/notes.js, following docs/conventions.md.')
    await c.exec('node --test')
  },
})

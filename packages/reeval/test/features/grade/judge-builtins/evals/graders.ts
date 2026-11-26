import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'

const shows = (text: string) =>
  fakeJudge({ score: (state) => (JSON.stringify(state).includes(text) ? 0.9 : 0.1) })

// The changed files show a dependency directory as one entry with its file count.
export const twoDependencyFiles = judge('Does the change add two files under node_modules/?', {
  inputs: { files: true },
  model: shows('changed node_modules/ (2 files)'),
})

export const touchesTests = judge('Does the change touch test/?', {
  inputs: { files: true },
  model: shows('test/'),
})

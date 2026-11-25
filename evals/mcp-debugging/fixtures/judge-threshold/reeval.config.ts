import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeJudge } from 'reeval/judge'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({
    files: {
      'README.md': '# notes\n\nA small notes CLI. Run `node notes.js add <text>`.\n',
    },
    text: 'Wrote README.md.',
  }),
  sandbox: fakeSandbox(),
  judge: { model: fakeJudge({ score: 0.85 }) },
})

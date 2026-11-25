import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeJudge } from 'reeval/judge'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({
    files: {
      'README.md':
        '# wordcount\n\nInstall with `npm i -g .`, then run `wordcount notes.txt`.\n' +
        'Run `wordcount --help` for usage.\n',
    },
    text: 'I wrote README.md.',
  }),
  sandbox: fakeSandbox(),
  judge: { model: fakeJudge({ score: 0.9 }) },
})

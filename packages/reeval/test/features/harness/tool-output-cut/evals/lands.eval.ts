import { defineEval, defineGrader } from 'reeval'
import { plain } from './env.ts'

const shellOutput = defineGrader('shell-output', {
  grade: (c) => {
    const shell = c.turns[0]?.trajectory.find((e) => e.type === 'tool' && e.tool === 'shell')
    return shell?.type === 'tool'
      ? {
          outputView: shell.outputView ?? null,
          whole: /\nline-15000\n.*END-OF-OUTPUT-77\n$/s.test(String(shell.output ?? '')),
        }
      : null
  },
  score: (shell) => (shell?.outputView === 'model' && shell.whole ? 1 : 0),
})

export default defineEval({
  environment: plain,
  graders: [shellOutput],
  task: async (c) => {
    await c.send('print thirty thousand lines')
  },
})

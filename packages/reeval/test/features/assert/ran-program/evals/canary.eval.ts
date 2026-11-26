import { defineEval, defineGrader } from 'reeval'
import { ran } from 'reeval/graders'
import { plain } from './env.ts'

/** The agent's shell commands, recorded only. */
const commands = defineGrader('commands', {
  weight: 0,
  grade: (c) =>
    c.turns.flatMap((t) =>
      t.trajectory.flatMap((e) =>
        e.type === 'tool' && e.tool === 'shell'
          ? [String((e.input as { command?: unknown })?.command)]
          : [],
      ),
    ),
})

export default defineEval({
  environment: plain,
  // The command line contains "deploy", but no segment runs a program named deploy.
  graders: [ran({ program: 'deploy' }), commands],
  task: async (c) => {
    await c.send('print the contract token')
  },
})

import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { observed, succeeded } from 'reeval/graders'
import { wrote } from 'reeval/graders/match'

// checks/call.mjs goes in the sandbox's home, outside the workspace and its diff.
const math = defineEnvironment('math', ({ directory, file }) => ({
  files: { ...directory('./project'), '~/checks/call.mjs': file('./checks/call.mjs') },
}))

// Each turn on its own: the share of turns whose tool calls edited src/math.js.
const editedEachTurn = defineGrader('edited-each-turn', {
  grade: (c) => c.turns.map((turn) => wrote({ turns: [turn] }, 'src/math.js').length > 0),
  score: (edited) => edited.filter(Boolean).length / edited.length,
})

export default defineEval({
  environment: math,
  graders: [
    editedEachTurn,
    observed('turn-1', (out) => out === '6'),
    observed('turn-2', (out) => out === '24'),
    observed('turn-2-two-args', (out) => out === '6'),
    succeeded('node --test'),
  ],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, with a test in test/math.test.js.')
    // An observation before the next c.send sees the workspace as this turn left it.
    const two = await c.exec('node ~/checks/call.mjs multiply 2 3')
    c.observe('turn-1', two.stdout.trim())

    await c.send('Now let multiply take any number of arguments: multiply(2, 3, 4) is 24.')
    const three = await c.exec('node ~/checks/call.mjs multiply 2 3 4')
    c.observe('turn-2', three.stdout.trim())
    const twoStill = await c.exec('node ~/checks/call.mjs multiply 2 3')
    c.observe('turn-2-two-args', twoStill.stdout.trim())
    await c.exec('node --test')
  },
})

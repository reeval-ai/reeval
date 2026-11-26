import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, judge, notInDiff, succeeded } from 'reeval/graders'

// The agent starts from ./project, where users.js and orders.js each parse records the same way.
const records = defineEnvironment('records', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: records,
  graders: [
    hasFile('src/parse.js', /export function/, { required: true }),
    succeeded('node --test'),
    notInDiff('test/**', { required: true }),
    judge('Do users.js and orders.js now both parse with parse.js, their loops gone?', {
      inputs: { diff: ['src/**'] },
    }),
  ],
  task: async (c) => {
    await c.send(
      'src/users.js and src/orders.js parse records the same way. Move that parsing into ' +
        'src/parse.js and use it from both, without changing what they return.',
    )
    await c.exec('node --test')
  },
})

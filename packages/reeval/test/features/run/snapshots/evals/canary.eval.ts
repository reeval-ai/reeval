import { defineEval, defineGrader } from 'reeval'
import { snapshots } from './env.ts'

// Must fail: the agent built the app, not something else. It takes no snapshot.
export default defineEval({
  snapshot: false,
  environment: snapshots,
  graders: [
    defineGrader('built.js', {
      files: ['app/built.js'],
      grade: (c) => c.readFile('app/built.js'),
      score: (text) => (text === 'something else' ? 1 : 0),
    }),
  ],
  task: async (c) => {
    await c.send('build the app')
  },
})

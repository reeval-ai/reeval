import { defineEval } from 'reeval'
import { hasFile, inDiff, wrote } from 'reeval/graders'
import { answers42, readable, tone, turnCount } from './graders.ts'

// Code, built-in and judge graders on one eval, under the config's turns().
export default defineEval({
  graders: [answers42, turnCount, hasFile('src/app.js'), inDiff('src/**'), wrote(), readable, tone],
  task: async (c) => void (await c.send('write the app')),
})

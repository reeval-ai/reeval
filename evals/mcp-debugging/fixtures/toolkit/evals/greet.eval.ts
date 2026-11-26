import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

export default defineEval({
  graders: [hasFile('src/greet.js', 'Hello, ', { name: 'says-hello' })],
  task: async (c) => {
    await c.send('Write src/greet.js: greet(name) returns "Hello, <name>!".')
  },
})

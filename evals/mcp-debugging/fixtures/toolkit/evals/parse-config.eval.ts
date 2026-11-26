import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

export default defineEval({
  graders: [hasFile('src/parse-config.js', 'JSON.parse(', { name: 'parses-JSON' })],
  task: async (c) => {
    await c.send('Write src/parse-config.js: parseConfig(path) reads a JSON config file.')
  },
})

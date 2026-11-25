import { defineEval, expect } from 'reeval'

export default defineEval({
  task: async (c) => {
    await c.send('Write src/parse-config.js: parseConfig(path) reads a JSON config file.')
    expect(await c.readFile('src/parse-config.js'), 'parses JSON').toContain('JSON.parse(')
  },
})

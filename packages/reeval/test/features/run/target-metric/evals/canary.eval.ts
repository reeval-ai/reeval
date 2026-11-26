import { defineEval, expect } from 'reeval'

// Must fail: the same body under the config's regression() fails on its expect.
export default defineEval({
  task: async (c) => {
    c.observe('pick', await c.readFile('pick.txt'))
    expect(await c.readFile('pick.txt'), 'picks postgres').toBe('postgres')
  },
})

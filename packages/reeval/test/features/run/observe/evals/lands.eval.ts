import { defineEval, expect } from 'reeval'

// gate: 'observe' records the pick and gates nothing: its failed expect leaves it `ran`, not failed.
export default defineEval({
  gate: 'observe',
  task: async (c) => {
    c.observe('pick', await c.readFile('pick.txt'))
    expect(await c.readFile('pick.txt'), 'picks postgres').toBe('postgres')
  },
})

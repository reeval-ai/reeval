import { evaluate, expect } from 'reeval'
import { agentSaw, vm } from './env.ts'

// Each slot is a container of its own on the machine, with the layout a machine of its own has.
evaluate('lands', { environments: vm }, async (c) => {
  expect(agentSaw(await c.send('where am I')).slice(0, 4)).toEqual([
    'reeval',
    '/reeval/workspace',
    '/home/reeval',
    'http://127.0.0.1:24128',
  ])
})

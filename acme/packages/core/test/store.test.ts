import assert from 'node:assert/strict'
import { test } from 'node:test'
import { seedState } from '../src/seed.ts'
import { createMemoryStore } from '../src/store.ts'
import { storeConformanceCases } from '../src/testing.ts'

for (const testCase of storeConformanceCases) {
  test(`memory store: ${testCase.name}`, () => testCase.run(() => createMemoryStore()))
}

test('memory store: a transaction whose result cannot be copied persists nothing', async () => {
  const store = createMemoryStore()
  await assert.rejects(
    store.transact((state) => {
      state.counters.cart = 50
      return () => undefined
    }),
  )
  assert.deepEqual(await store.read(), seedState())
})

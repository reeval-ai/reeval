import { runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { seedState } from '@acme/core'
import { storeConformanceCases } from '@acme/core/testing'
import { describe, expect, test } from 'vitest'
import { freshKey } from './helpers.ts'

describe('Durable Object store conformance', () => {
  for (const testCase of storeConformanceCases) {
    test(testCase.name, async () => {
      const stub = env.TENANT.get(env.TENANT.idFromName(freshKey('conformance')))
      await runInDurableObject(stub, (instance) => testCase.run(() => instance.store))
    })
  }

  test('there are conformance cases to run', () => {
    expect(storeConformanceCases.length).toBeGreaterThan(0)
  })
})

test('a transaction whose result cannot be copied persists nothing', async () => {
  const stub = env.TENANT.get(env.TENANT.idFromName(freshKey('uncopyable')))
  await runInDurableObject(stub, async (instance) => {
    await expect(
      instance.store.transact((state) => {
        state.counters.cart = 50
        return () => undefined
      }),
    ).rejects.toThrow()
    expect(await instance.store.read()).toEqual(seedState())
  })
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryStore, createServices } from '@acme/core'
import { storeConformanceCases } from '@acme/core/testing'

test('a package imports another workspace package as source', async () => {
  const acme = createServices(createMemoryStore(), () => new Date())
  assert.equal((await acme.products.get('prod_001')).id, 'prod_001')
  assert.ok(storeConformanceCases.length > 0)
})

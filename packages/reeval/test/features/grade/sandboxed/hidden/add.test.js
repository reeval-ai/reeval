import assert from 'node:assert/strict'
import { test } from 'node:test'
import { add } from '../src/add.js'

test('adds', () => assert.equal(add(2, 3), 5))
test('adds negatives', () => assert.equal(add(-2, -3), -5))

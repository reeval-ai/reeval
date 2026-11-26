import assert from 'node:assert/strict'
import { test } from 'node:test'
import { add } from '../src/add.js'

test('adds', () => assert.equal(add(2, 3), 5))
// The mistake: the hidden test expects the wrong sum.
test('adds twos', () => assert.equal(add(2, 2), 5))

import assert from 'node:assert/strict'
import { createSocket } from 'node:dgram'
import { after, before, describe, test } from 'node:test'
import { resolverLookup } from '../src/egress/policy.ts'

const A = 1

/**
 * A DNS server on loopback: `fast.test` has an A record, `missing.test` doesn't exist, and
 * `hang.test` never gets an answer, like a cloud metadata host asked from a VM elsewhere.
 */
function dnsServer() {
  const socket = createSocket('udp4')
  const asked: string[] = []
  socket.on('message', (query, from) => {
    const labels: string[] = []
    let at = 12
    for (let length = query.readUInt8(at); length; length = query.readUInt8(at)) {
      labels.push(query.subarray(at + 1, at + 1 + length).toString())
      at += length + 1
    }
    const name = labels.join('.')
    const type = query.readUInt16BE(at + 1)
    asked.push(name)
    if (name === 'hang.test') return
    const question = query.subarray(12, at + 5)
    const answer =
      name === 'fast.test' && type === A
        ? Buffer.from([0xc0, 12, 0, A, 0, 1, 0, 0, 0, 60, 0, 4, 93, 184, 216, 34])
        : Buffer.alloc(0)
    const header = Buffer.alloc(12)
    query.copy(header, 0, 0, 2)
    // A response, recursion available, NXDOMAIN for a name that doesn't exist.
    header.writeUInt16BE(0x8180 | (name === 'missing.test' ? 3 : 0), 2)
    header.writeUInt16BE(1, 4)
    header.writeUInt16BE(answer.length ? 1 : 0, 6)
    socket.send(Buffer.concat([header, question, answer]), from.port, from.address)
  })
  return { socket, asked }
}

describe('resolverLookup', () => {
  const server = dnsServer()
  let servers: string[]
  before(async () => {
    await new Promise<void>((resolve) => server.socket.bind(0, '127.0.0.1', resolve))
    servers = [`127.0.0.1:${server.socket.address().port}`]
  })
  after(() => server.socket.close())

  test("a name whose lookups hang doesn't hold up another name's", async () => {
    const lookup = resolverLookup({ servers, timeoutMs: 1500, tries: 1 })
    // More hanging lookups than libuv's four threads, which getaddrinfo would share.
    const hanging = Array.from({ length: 8 }, () => lookup('hang.test').catch((e: Error) => e))
    const started = Date.now()
    assert.deepEqual(await lookup('fast.test'), ['93.184.216.34'])
    assert.ok(Date.now() - started < 1000, `fast.test took ${Date.now() - started}ms`)
    for (const result of await Promise.all(hanging)) {
      assert.equal((result as NodeJS.ErrnoException).code, 'ETIMEOUT')
    }
  })

  test("a name that doesn't exist is refused from the cache; a timeout isn't cached", async () => {
    const lookup = resolverLookup({ servers, timeoutMs: 500, tries: 1 })
    const count = (name: string) => server.asked.filter((n) => n === name).length
    const before = count('missing.test')
    await assert.rejects(lookup('missing.test'), { code: 'ENOTFOUND' })
    const asked = count('missing.test') - before
    assert.ok(asked > 0)
    await assert.rejects(lookup('missing.test'), { code: 'ENOTFOUND' })
    assert.equal(count('missing.test') - before, asked)
    // Twin: a lookup that timed out asks the servers again.
    const hung = count('hang.test')
    await assert.rejects(lookup('hang.test'), { code: 'ETIMEOUT' })
    await assert.rejects(lookup('hang.test'), { code: 'ETIMEOUT' })
    assert.equal(count('hang.test') - hung, 4)
  })

  test('localhost names and unreachable servers go to the fallback', async () => {
    const fallback = async (host: string) => [`fallback:${host}`]
    const lookup = resolverLookup({ servers, fallback })
    assert.deepEqual(await lookup('localhost'), ['fallback:localhost'])
    assert.deepEqual(await lookup('api.localhost'), ['fallback:api.localhost'])
    // Nothing listens on port 9 over TCP, and a refused UDP query answers ECONNREFUSED.
    const nowhere = resolverLookup({ servers: ['127.0.0.1:9'], fallback, timeoutMs: 500, tries: 1 })
    assert.deepEqual(await nowhere('example.test'), ['fallback:example.test'])
    // Twin: a name the servers answer never reaches the fallback.
    assert.deepEqual(await lookup('fast.test'), ['93.184.216.34'])
  })
})

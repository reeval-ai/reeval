import assert from 'node:assert/strict'
import { type ChildProcess, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const bin = fileURLToPath(new URL('../dist/node.mjs', import.meta.url))

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

function listening(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      out += chunk.toString()
      if (out.includes('\n')) resolve(out.trim())
    })
    child.once('exit', (code) => reject(new Error(`exited early with ${code}`)))
  })
}

// Subscribed at spawn: a child that fails to start has exited before the test's cleanup runs.
function exitOf(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => child.once('exit', (code) => resolve(code)))
}

function canListen(host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.listen(0, host, () => server.close(() => resolve(true)))
  })
}

function envWithout(...names: string[]): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const name of names) delete env[name]
  return env
}

test('the built acme-server answers /health, enforces auth and stops on SIGTERM', async () => {
  const port = await freePort()
  const child = spawn(process.execPath, [bin], {
    env: { ...envWithout('HOST'), PORT: String(port) },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const exited = exitOf(child)
  try {
    const line = await listening(child)
    assert.equal(line, `acme-server listening on http://127.0.0.1:${port}`)

    const health = await fetch(`http://localhost:${port}/health`)
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { ok: true })

    const denied = await fetch(`http://localhost:${port}/v1/products`)
    assert.equal(denied.status, 401)
    const ok = await fetch(`http://localhost:${port}/v1/products`, {
      headers: { authorization: 'Bearer acme_test_node' },
    })
    assert.equal(ok.status, 200)

    child.kill('SIGTERM')
    assert.equal(await exited, 0)
  } finally {
    child.kill('SIGTERM')
    await exited
  }
})

test('the built acme-server listens on HOST when it is set', async (t) => {
  if (!(await canListen('::1'))) {
    t.skip('this machine has no IPv6 loopback')
    return
  }
  const child = spawn(process.execPath, [bin], {
    env: { ...process.env, HOST: '::1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const exited = exitOf(child)
  try {
    const line = await listening(child)
    const port = /^acme-server listening on http:\/\/\[::1\]:(\d+)$/.exec(line)?.[1]
    assert.ok(port, line)
    assert.equal((await fetch(`http://[::1]:${port}/health`)).status, 200)
  } finally {
    child.kill('SIGTERM')
    await exited
  }
})

test('the built acme-server exits 1 with one line on stderr for a PORT out of range', async () => {
  for (const value of ['abc', '65536', '-1', '1.5', '', ' 80', '0x50', '1e3']) {
    const child = spawn(process.execPath, [bin], {
      env: { ...process.env, PORT: value },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    const code = await new Promise((resolve) => child.once('close', resolve))
    assert.deepEqual(
      { code, stdout, stderr },
      {
        code: 1,
        stdout: '',
        stderr: `acme-server: PORT must be an integer from 0 to 65535, got "${value}"\n`,
      },
      value,
    )
  }
})

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const bin = fileURLToPath(new URL('../src/bin.ts', import.meta.url))

interface Exit {
  code: number | null
  stdout: string
  stderr: string
}

function acme(
  argv: string[],
  options: { env?: NodeJS.ProcessEnv; closeStdout?: boolean } = {},
): Promise<Exit> {
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', bin, ...argv],
    { env: options.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  if (options.closeStdout) child.stdout.destroy()
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  return new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function envWithout(...names: string[]): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const name of names) delete env[name]
  return env
}

test('the bin exits 1 and names ACME_API_KEY when it is not set', async () => {
  const result = await acme(['reset'], { env: envWithout('ACME_API_KEY', 'ACME_BASE_URL') })
  assert.deepEqual(result, {
    code: 1,
    stdout: '',
    stderr: 'error: Acme needs an API key: pass `apiKey` or set ACME_API_KEY\n',
  })
})

test('the bin exits 0 with no stack trace when its reader closes stdout early', async () => {
  const result = await acme(['--help'], { closeStdout: true })
  assert.equal(result.stderr, '')
  assert.equal(result.code, 0)
})

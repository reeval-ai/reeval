import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineEval, expect } from 'reeval'
import { binaryFile, hostBlob, sandboxSha256 } from './env.ts'

// Must fail: the file isn't the host bytes decoded and re-encoded as UTF-8.
export default defineEval({
  environment: binaryFile,
  task: async (c) => {
    const asText = Buffer.from(readFileSync(hostBlob).toString('utf8'))
    const mangled = createHash('sha256').update(asText).digest('hex')
    expect((await c.exec(sandboxSha256)).stdout).toBe(mangled)
  },
})

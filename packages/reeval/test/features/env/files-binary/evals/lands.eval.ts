import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineEval, expect } from 'reeval'
import { binaryFile, hostBlob, sandboxSha256 } from './env.ts'

// A host `file()` lands byte for byte.
export default defineEval({
  environment: binaryFile,
  task: async (c) => {
    const onHost = createHash('sha256').update(readFileSync(hostBlob)).digest('hex')
    expect((await c.exec(sandboxSha256)).stdout).toBe(onHost)
  },
})

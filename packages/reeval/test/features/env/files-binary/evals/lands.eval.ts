import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineEval } from 'reeval'
import { binaryFile, hostBlob, prints, sandboxSha256 } from './env.ts'

const onHost = createHash('sha256').update(readFileSync(hostBlob)).digest('hex')

// A host `file()` lands byte for byte.
export default defineEval({
  environment: binaryFile,
  graders: [prints('host-bytes', sandboxSha256, onHost)],
  task: async (c) => {
    await c.exec(sandboxSha256)
  },
})

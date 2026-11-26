import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineEval } from 'reeval'
import { binaryFile, hostBlob, prints, sandboxSha256 } from './env.ts'

const asText = Buffer.from(readFileSync(hostBlob).toString('utf8'))
const mangled = createHash('sha256').update(asText).digest('hex')

// Must fail: the file isn't the host bytes decoded and re-encoded as UTF-8.
export default defineEval({
  environment: binaryFile,
  graders: [prints('utf8-bytes', sandboxSha256, mangled)],
  task: async (c) => {
    await c.exec(sandboxSha256)
  },
})

import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// As the agent: print the unbrokered secret raw, base64-, URL- and JSON-encoded, one per line,
// and write them to leak.txt, so they reach the trajectory, the diff and what the judge is sent.
const leak = `node -e '
const v = process.env.LEAKY_TOKEN
const forms = [v, Buffer.from(v).toString("base64"), encodeURIComponent(v), JSON.stringify(v).slice(1, -1)]
require("node:fs").writeFileSync("leak.txt", forms.join("\\n"))
console.log(forms.join("\\n"))
'`

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ script: [[{ exec: leak }]] }),
})

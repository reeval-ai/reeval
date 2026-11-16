// Builds reeval's sandbox image for each baked harness, which the Docker tests need, or only the
// harnesses named. Needs Docker and `pnpm build` first.
//
//   pnpm images                     every harness: cursor, claude-code, antigravity, …
//   pnpm images claude-code codex   only those
//   pnpm images --registry ghcr.io/reeval-ai/sandbox --push
//                                   build and push each image the registry doesn't have yet, under
//                                   the ref `reeval --registry` pulls it by
import { parseArgs } from 'node:util'
import { setupOf } from '../packages/agents/dist/index.js'
import {
  BAKED_HARNESSES,
  bakedRecipe,
  buildImage,
  docker,
  enginePlatform,
  imageFor,
  pushLayer,
  reevalImageKey,
  registryProblem,
  registryRef,
} from '../packages/sandbox-docker/dist/index.js'

const { values, positionals: asked } = parseArgs({
  allowPositionals: true,
  options: { registry: { type: 'string' }, push: { type: 'boolean' } },
})
const fail = (message, code = 1) => {
  console.error(message)
  process.exit(code)
}
const unknown = asked.filter((h) => !BAKED_HARNESSES.includes(h))
if (unknown.length)
  fail(`Unknown harness ${unknown.join(', ')}. Use ${BAKED_HARNESSES.join(', ')}.`, 2)
if (!values.push !== !values.registry) fail('--registry and --push go together', 2)
const problem = values.registry && registryProblem(values.registry)
if (problem) fail(problem, 2)

const platform = values.push ? await enginePlatform() : null
// One harness failing still builds the others, so a publish leaves as few gaps as it can.
let failed = 0
for (const harness of asked.length ? asked : BAKED_HARNESSES) {
  const bootstrap = setupOf(harness)
  const layer = {
    ref: imageFor(harness),
    key: reevalImageKey(harness, await bakedRecipe(bootstrap)),
  }
  if (values.push) {
    const remote = registryRef(values.registry, layer, platform)
    // Any other answer builds and pushes it, which only repeats work if it was there after all.
    if ((await docker(['manifest', 'inspect', remote])).exitCode === 0) {
      console.log(`${remote} is already in the registry`)
      continue
    }
  }
  console.log(`Building ${layer.ref}`)
  try {
    await buildImage(console.log, { harness, bootstrap })
    if (values.push) console.log(`Pushed ${await pushLayer(values.registry, layer)}`)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    failed++
  }
}
if (failed) fail(`${failed} image${failed === 1 ? '' : 's'} failed`)

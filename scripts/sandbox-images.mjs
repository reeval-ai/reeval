// Builds reeval's sandbox image for each baked harness, which the Docker tests need, or only the
// harnesses named. Needs Docker and `pnpm build` first.
//
//   pnpm images                     every harness: cursor, claude-code, antigravity, …
//   pnpm images claude-code codex   only those
//   pnpm images --registry ghcr.io/reeval-ai/sandbox --push
//                                   build and push each image the registry doesn't have yet, under
//                                   the ref reeval pulls it by
//   pnpm images --registry ghcr.io/reeval-ai/sandbox --digests packages/reeval/dist/image-digests.json
//                                   build nothing: write the digest each image's ref has there, for
//                                   linux/amd64 and linux/arm64, which reeval pulls the image by.
//                                   Fails when the registry doesn't answer; with --strict, also
//                                   when an image isn't published
import { writeFileSync } from 'node:fs'
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
  options: {
    registry: { type: 'string' },
    push: { type: 'boolean' },
    digests: { type: 'string' },
    strict: { type: 'boolean' },
  },
})
const fail = (message, code = 1) => {
  console.error(message)
  process.exit(code)
}
const unknown = asked.filter((h) => !BAKED_HARNESSES.includes(h))
if (unknown.length)
  fail(`Unknown harness ${unknown.join(', ')}. Use ${BAKED_HARNESSES.join(', ')}.`, 2)
if (values.push && values.digests) fail('--push and --digests are separate runs', 2)
if (!(values.push || values.digests) !== !values.registry) {
  fail('--registry goes with --push or --digests', 2)
}
const problem = values.registry && registryProblem(values.registry)
if (problem) fail(problem, 2)

/**
 * The digest `ref` names in its registry, over the registry API with an anonymous token, or null
 * when the registry says it has no such ref. Any other answer throws.
 */
async function digestOf(ref) {
  const [, host, repository, tag] = /^([^/]+)\/(.+):([^:/]+)$/.exec(ref)
  const url = `https://${host}/v2/${repository}/manifests/${tag}`
  const accept = [
    'application/vnd.oci.image.index.v1+json',
    'application/vnd.oci.image.manifest.v1+json',
    'application/vnd.docker.distribution.manifest.list.v2+json',
    'application/vnd.docker.distribution.manifest.v2+json',
  ].join(', ')
  const head = (auth) =>
    fetch(url, {
      method: 'HEAD',
      headers: { accept, ...auth },
      signal: AbortSignal.timeout(30_000),
    })
  let r = await head({})
  const challenge = /^Bearer (.*)$/i.exec(r.headers.get('www-authenticate') ?? '')?.[1]
  if (r.status === 401 && challenge) {
    const params = Object.fromEntries(
      [...challenge.matchAll(/(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, v]),
    )
    const scope = params.scope ?? `repository:${repository}:pull`
    const query = new URLSearchParams({
      ...(params.service ? { service: params.service } : {}),
      scope,
    })
    const token = await fetch(`${params.realm}?${query}`, { signal: AbortSignal.timeout(30_000) })
    const { token: bearer, access_token } = await token.json()
    r = await head({ authorization: `Bearer ${bearer ?? access_token}` })
  }
  if (r.status === 404) return null
  const digest = r.ok && r.headers.get('docker-content-digest')
  if (!digest) throw new Error(`${ref}: the registry answered ${r.status} with no digest`)
  return digest
}

if (values.digests) {
  const digests = {}
  let missing = 0
  for (const harness of asked.length ? asked : BAKED_HARNESSES) {
    const layer = {
      ref: imageFor(harness),
      key: reevalImageKey(harness, await bakedRecipe(setupOf(harness))),
    }
    for (const platform of ['linux/amd64', 'linux/arm64']) {
      const remote = registryRef(values.registry, layer, platform)
      const digest = await digestOf(remote).catch((e) => fail(e.message))
      if (digest) digests[remote] = digest
      else missing++
      console.log(`${remote}: ${digest ?? 'not published, so reeval builds it'}`)
    }
  }
  if (values.strict && missing)
    fail(`${missing} image${missing === 1 ? " isn't" : "s aren't"} published yet`)
  writeFileSync(values.digests, `${JSON.stringify(digests, null, 2)}\n`)
  process.exit(0)
}

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
    // Only a ref the registry says it lacks is pushed: pushing a key again gives it another
    // digest, and a released reeval pins the first.
    const inspect = await docker(['manifest', 'inspect', remote])
    if (inspect.exitCode === 0) {
      console.log(`${remote} is already in the registry`)
      continue
    }
    if (!/manifest unknown|no such manifest/i.test(inspect.stderr.toString())) {
      console.error(`Couldn't look up ${remote}: ${inspect.stderr.toString().trim()}`)
      failed++
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

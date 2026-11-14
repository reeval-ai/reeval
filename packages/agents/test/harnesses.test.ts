// The catalog's adapters: each harness's own on every route it takes, configured from the route
// and never from the host's environment.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AgentKind } from '../src/catalog/entry.ts'
import { HARNESSES } from '../src/catalog/index.ts'
import {
  type AgentRoute,
  catalogAdapter,
  claudeCodeVertexEnv,
  cursor,
  fxVertex,
  grokVertexChat,
  type HarnessSpec,
} from '../src/harnesses.ts'
import { ROUTES } from '../src/routes/index.ts'
import { VERTEX_ROUTES } from '../src/routes/vertex.ts'

const MODELS: Record<AgentKind, string> = {
  cursor: 'composer-2.5',
  'claude-code': 'claude-haiku-4-5',
  antigravity: 'gemini-3.8-flash',
  opencode: 'google/gemini-3.8-flash',
  goose: 'google/gemini-3.8-flash',
  pi: 'google/gemini-3.8-flash',
  codex: 'gpt-5.5',
  fx: 'gpt-4.1-mini',
  'grok-build': 'grok-4.6',
}

const VERTEX = {
  kind: 'vertex',
  project: 'p',
  location: 'us-east5',
  regions: { xai: 'us-central1' },
  credentialsFile: '/home/adc.json',
  accessToken: 'placeholder',
} as const

/** The key each harness takes on each route: its own, or the route's. */
function authFor(kind: AgentKind, route: AgentRoute): Record<string, string> {
  if (route.kind === 'vertex') return {}
  if (route.kind !== 'direct') {
    const config = ROUTES[route.kind].routes[kind]?.({})
    return config ? { [config.credential]: 'k' } : {}
  }
  const keys: Partial<Record<AgentKind, string>> = {
    opencode: 'GOOGLE_GENERATIVE_AI_API_KEY',
    goose: 'GOOGLE_API_KEY',
    pi: 'GEMINI_API_KEY',
    fx: 'OPENAI_API_KEY',
  }
  const own = keys[kind] ?? (HARNESSES[kind].credential as string)
  return { [own]: 'k' }
}

/** The model id the harness asks for on the route, as `agent()` makes it. */
function modelOn(harness: HarnessSpec, route: AgentRoute): string {
  const config =
    route.kind === 'vertex'
      ? VERTEX_ROUTES[harness.kind]
      : route.kind === 'direct'
        ? undefined
        : ROUTES[route.kind].routes[harness.kind]?.({})
  return (config?.modelId ?? HARNESSES[harness.kind].modelId)?.(harness.model) ?? harness.model
}

const build = (harness: HarnessSpec, route: AgentRoute) =>
  catalogAdapter({
    auth: authFor(harness.kind, route),
    model: modelOn(harness, route),
    harness,
    route,
    plugins: [],
    env: {},
    describeModel: async () => undefined,
  })

test('every harness builds its own adapter on each route it takes', async () => {
  for (const kind of Object.keys(HARNESSES) as AgentKind[]) {
    const harness = { kind, model: MODELS[kind] } as HarnessSpec
    const routes: AgentRoute[] = [{ kind: 'direct' }]
    for (const name of ['vercel', 'openrouter'] as const) {
      if (ROUTES[name].routes[kind]) routes.push({ kind: name })
    }
    if (VERTEX_ROUTES[kind]) routes.push(VERTEX)
    for (const route of routes) {
      const adapter = await build(harness, route)
      assert.equal(adapter.specificationVersion, 'harness-v1', `${kind} on ${route.kind}`)
    }
  }
})

test('on Vertex AI, each CLI is pointed at its publisher’s region and what it reads', async () => {
  assert.deepEqual(claudeCodeVertexEnv(VERTEX), {
    CLAUDE_CODE_USE_VERTEX: '1',
    CLAUDE_CODE_SKIP_VERTEX_AUTH: '1',
    ANTHROPIC_VERTEX_PROJECT_ID: 'p',
    CLOUD_ML_REGION: 'us-east5',
  })
  assert.deepEqual(fxVertex(VERTEX), { project: 'p', location: 'us-east5' })
  assert.deepEqual(grokVertexChat(VERTEX), { project: 'p', region: 'us-central1' })
  const { credentialsFile: _, accessToken: __, ...bare } = VERTEX
  await assert.rejects(
    build({ kind: 'goose', model: 'google/gemini-3.8-flash' }, bare),
    /Goose on Vertex AI reads a service account: set the route's credentialsFile/,
  )
  await assert.rejects(
    build({ kind: 'grok-build', model: 'grok-4.6' }, bare),
    /Grok Build on Vertex AI sends a bearer of its own: set the route's accessToken/,
  )
})

test('a provider a harness has no direct way to is refused by name', async () => {
  await assert.rejects(
    build({ kind: 'opencode', model: 'nowhere/model' }, { kind: 'direct' }),
    /^AgentError: opencode\(\): /,
  )
  await assert.rejects(
    build({ kind: 'pi', model: 'nowhere/model' }, { kind: 'direct' }),
    /^AgentError: pi\(\): /,
  )
  assert.deepEqual(cursor({ model: 'composer-2.5', params: { fast: 'false' } }), {
    kind: 'cursor',
    model: 'composer-2.5',
    params: { fast: 'false' },
  })
})

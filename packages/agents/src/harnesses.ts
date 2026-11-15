// The harnesses a session runs, as plain data, the routes their model calls take, and how each
// harness's AI SDK adapter is built from them and what the session gives it.
import type { HarnessV1 } from '@ai-sdk/harness'
import type { GooseProvider } from '@reeval/harness-goose'
import type { OpenCodeMcpServer } from '@reeval/harness-opencode'
import type { PiMcpServer, PiModelInfo } from '@reeval/harness-pi'
import type { AgentKind } from './catalog/entry.ts'
import { providerOf } from './catalog/provider-model.ts'
import { AgentError } from './errors.ts'
import { vercelApi } from './routes/vercel.ts'
import { type VertexSettings, vertexRegion } from './routes/vertex.ts'
import type { PlacedPlugin } from './spec.ts'

/** Which harness a session runs, on which model. */
export type HarnessSpec =
  | {
      kind: 'cursor'
      model: string
      effort?: string
      /** The model's parameters, as Cursor names them (`fast`, `reasoning_effort`, …). */
      params?: Readonly<Record<string, string>>
    }
  | { kind: 'claude-code'; model: string; effort?: ClaudeCodeEffort }
  | { kind: Exclude<AgentKind, 'cursor' | 'claude-code'>; model: string; effort?: string }

/** The reasoning effort Claude Code's `/effort` control takes. */
export type ClaudeCodeEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

type SpecOf<K extends AgentKind> = Omit<Extract<HarnessSpec, { kind: K }>, 'kind'>
type Spec = { model: string; effort?: string }

export const cursor = (spec: SpecOf<'cursor'>): HarnessSpec => ({ kind: 'cursor', ...spec })
export const claudeCode = (spec: SpecOf<'claude-code'>): HarnessSpec => ({
  kind: 'claude-code',
  ...spec,
})
export const antigravity = (spec: Spec): HarnessSpec => ({
  kind: 'antigravity',
  ...spec,
})
/** `model` is `<provider>/<id>`. */
export const opencode = (spec: Spec): HarnessSpec => ({ kind: 'opencode', ...spec })
/** `model` is `<provider>/<id>`. */
export const goose = (spec: Spec): HarnessSpec => ({ kind: 'goose', ...spec })
/** `model` is `<provider>/<id>`. */
export const pi = (spec: Spec): HarnessSpec => ({ kind: 'pi', ...spec })
export const codex = (spec: Spec): HarnessSpec => ({ kind: 'codex', ...spec })
export const fx = (spec: Spec): HarnessSpec => ({ kind: 'fx', ...spec })
export const grokBuild = (spec: Spec): HarnessSpec => ({
  kind: 'grok-build',
  ...spec,
})

/**
 * Where a harness's model calls go: its provider's own API (`direct`), Vercel AI Gateway,
 * OpenRouter, or Vertex AI in a project, with `regions` naming a publisher's own region.
 */
export type AgentRoute =
  | { kind: 'direct' }
  | { kind: 'vercel' }
  | { kind: 'openrouter' }
  | {
      kind: 'vertex'
      project: string
      location: string
      regions?: VertexSettings['regions']
      /**
       * A service account in the runner, for a CLI that authenticates with Application Default
       * Credentials (Antigravity, OpenCode, Goose, pi).
       */
      credentialsFile?: string
      /**
       * The bearer a CLI that calls Vertex's Chat Completions API sends (Grok Build): an access
       * token, or a placeholder the runner's network replaces with one.
       */
      accessToken?: string
    }

/** What a harness's adapter is built from. */
export type AdapterInput = {
  /** The session's credentials, by variable. */
  auth: Record<string, string>
  /** The model id the agent asks for on its route. */
  model: string
  effort?: string
  /** The session's MCP servers, in the shape the harness's CLI takes them. */
  mcpServers?: Record<string, unknown>
}

/** Everything a catalog adapter is built from. */
export type AdapterContext = AdapterInput & {
  harness: HarnessSpec
  route: AgentRoute
  plugins: readonly PlacedPlugin[]
  /** The host environment a route's URLs and OpenCode's provider are read from. */
  env: NodeJS.ProcessEnv
  /** A gateway model's limits, for pi on a gateway that doesn't describe the model. */
  describeModel?: (model: string) => Promise<PiModelInfo | undefined>
  /** The fetch the adapter's own calls from the host go through (Cursor's model list); the global one by default. */
  fetch?: typeof fetch
}

/** `each`'s entry for the routing gateway `route` names; undefined on direct and Vertex AI. */
const onGateway = <T>(route: AgentRoute, each: { vercel: T; openrouter: T }): T | undefined =>
  route.kind === 'vercel' || route.kind === 'openrouter' ? each[route.kind] : undefined

type VertexRoute = Extract<AgentRoute, { kind: 'vertex' }>

const settingsOf = (route: VertexRoute): VertexSettings => ({
  project: route.project,
  location: route.location,
  regions: route.regions ?? {},
})

/** The project, Gemini's region and the service account, for a CLI on Application Default Credentials. */
function adcOf(route: AgentRoute, name: string) {
  if (route.kind !== 'vertex') return undefined
  if (!route.credentialsFile) {
    throw new AgentError(
      `${name} on Vertex AI reads a service account: set the route's credentialsFile to one in the runner`,
    )
  }
  return {
    project: route.project,
    location: vertexRegion(settingsOf(route), 'google'),
    credentialsFile: route.credentialsFile,
  }
}

/** Claude Code's variables that point it at the route's project and Anthropic's region. */
export const claudeCodeVertexEnv = (route: VertexRoute): Record<string, string> => ({
  CLAUDE_CODE_USE_VERTEX: '1',
  CLAUDE_CODE_SKIP_VERTEX_AUTH: '1',
  ANTHROPIC_VERTEX_PROJECT_ID: route.project,
  CLOUD_ML_REGION: vertexRegion(settingsOf(route), 'anthropic'),
})

/** Where fx's configured provider calls Vertex's Chat Completions API: Gemini's region. */
export const fxVertex = (route: VertexRoute) => ({
  project: route.project,
  location: vertexRegion(settingsOf(route), 'google'),
})

/** Where Grok Build calls Vertex's Chat Completions API: xAI's region. */
export const grokVertexChat = (route: VertexRoute) => ({
  project: route.project,
  region: vertexRegion(settingsOf(route), 'xai'),
})

const servers = <T>(mcpServers: Record<string, unknown> | undefined) =>
  mcpServers ? { mcpServers: mcpServers as Record<string, T> } : {}

const effortOf = (effort: string | undefined) => (effort ? { effort } : {})

const pluginDirs = (plugins: readonly PlacedPlugin[]) =>
  plugins.length ? { plugins: plugins.map(({ name, dir }) => ({ name, dir })) } : {}

/** The harness's AI SDK adapter, configured for its route; it never reads the host's own auth. */
export async function catalogAdapter(c: AdapterContext): Promise<HarnessV1> {
  const { auth, model, effort, mcpServers, harness, route, plugins, env } = c
  switch (harness.kind) {
    case 'cursor':
      return (await import('@reeval/harness-cursor-sdk')).createCursorSdk({
        auth,
        ...(mcpServers ? { mcpServers } : {}),
        ...(harness.params ? { modelParams: harness.params } : {}),
        ...effortOf(effort),
        ...(c.fetch ? { fetch: c.fetch } : {}),
        requireCredentialBrokering: true,
      }) as unknown as HarnessV1
    case 'claude-code': {
      const vertex = route.kind === 'vertex' ? claudeCodeVertexEnv(route) : {}
      return (await import('@ai-sdk/harness-claude-code')).createClaudeCode({
        auth,
        ...(mcpServers ? { mcpServers } : {}),
        ...(harness.effort ? { effort: harness.effort } : {}),
        env: {
          // The CLI refuses to skip permissions as root unless told it's in a sandbox.
          IS_SANDBOX: '1',
          // No telemetry, error reporting or feature-flag fetches: fewer endpoints for the key,
          // and flags that can't change between runs.
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
          ...vertex,
        },
      }) as unknown as HarnessV1
    }
    case 'antigravity': {
      const vertex = adcOf(route, 'Antigravity')
      return (await import('@reeval/harness-antigravity')).createAntigravity({
        auth,
        ...(vertex ? { vertex } : {}),
        ...(mcpServers ? { mcpServers } : {}),
        ...pluginDirs(plugins),
        ...effortOf(effort),
        // A runner whose network can't broker the key must not get it.
        requireCredentialBrokering: true,
      }) as unknown as HarnessV1
    }
    case 'opencode': {
      const opencode = await import('@reeval/harness-opencode')
      const vertex = adcOf(route, 'OpenCode')
      let vars: Record<string, string> | undefined
      if (!vertex) {
        const resolved = opencode.resolveOpenCodeProvider(model, env)
        if ('error' in resolved) throw new AgentError(`opencode(): ${resolved.error}`)
        vars = resolved.vars
      }
      return opencode.createOpenCode({
        auth,
        model,
        ...(vertex ? { vertex } : { vars }),
        ...effortOf(effort),
        ...servers<OpenCodeMcpServer>(mcpServers),
        requireCredentialBrokering: true,
      }) as unknown as HarnessV1
    }
    case 'goose': {
      const goose = await import('@reeval/harness-goose')
      const direct: Record<string, GooseProvider> = {
        google: goose.GEMINI_PROVIDER,
        anthropic: goose.ANTHROPIC_PROVIDER,
        openai: goose.OPENAI_PROVIDER,
        xai: goose.XAI_PROVIDER,
      }
      const vertex = adcOf(route, 'Goose')
      const provider =
        onGateway(route, {
          vercel: goose.AI_GATEWAY_PROVIDER,
          openrouter: goose.OPENROUTER_PROVIDER,
        }) ?? direct[providerOf(harness.model)]
      return goose.createGoose({
        ...(vertex ? { vertex } : provider ? { provider } : {}),
        auth,
        model,
        ...effortOf(effort),
        ...servers<Record<string, unknown>>(mcpServers),
        requireCredentialBrokering: true,
      }) as unknown as HarnessV1
    }
    case 'pi': {
      const pi = await import('@reeval/harness-pi')
      const api = vercelApi(env)
      const gateway = onGateway(route, {
        vercel: { ...pi.PI_AI_GATEWAY, openai: api.openai, anthropic: api.anthropic },
        openrouter: pi.PI_OPENROUTER,
      })
      const modelInfo =
        gateway && model && !pi.piGatewayDescribes(gateway, model)
          ? await c.describeModel?.(model)
          : undefined
      let source: Pick<Parameters<typeof pi.createPi>[0], 'gateway' | 'vertex' | 'provider'>
      if (gateway) source = { gateway, ...(modelInfo ? { modelInfo } : {}) }
      else if (route.kind === 'vertex') source = { vertex: adcOf(route, 'pi') }
      else {
        const provider = (await import('@reeval/harness-pi/providers')).piProvider(
          providerOf(harness.model),
        )
        if ('refused' in provider) throw new AgentError(`pi(): ${provider.refused}`)
        source = { provider }
      }
      return pi.createPi({
        auth,
        ...source,
        ...effortOf(effort),
        ...servers<PiMcpServer>(mcpServers),
        requireCredentialBrokering: true,
      }) as unknown as HarnessV1
    }
    case 'codex': {
      const codex = await import('@reeval/harness-codex')
      const provider = onGateway(route, {
        vercel: { ...codex.AI_GATEWAY_PROVIDER, baseUrl: vercelApi(env).openai },
        openrouter: codex.OPENROUTER_PROVIDER,
      })
      return codex.createCodex({
        auth,
        ...(provider ? { provider } : {}),
        ...effortOf(effort),
        ...servers<Record<string, unknown>>(mcpServers),
        ...pluginDirs(plugins),
        requireCredentialBrokering: true,
      }) as unknown as HarnessV1
    }
    case 'fx':
      return (await import('@reeval/harness-fx')).createFx({
        auth,
        model,
        // On Vercel AI Gateway, the model id picks fx's own provider.
        ...onGateway(route, {
          vercel: { gatewayUrl: vercelApi(env).origin },
          openrouter: { provider: 'openrouter' as const },
        }),
        ...(route.kind === 'vertex' ? { vertex: fxVertex(route) } : {}),
        ...effortOf(effort),
        ...servers<Record<string, unknown>>(mcpServers),
        requireCredentialBrokering: true,
      }) as unknown as HarnessV1
    case 'grok-build': {
      const grok = await import('@reeval/harness-grok-build')
      let access: Pick<Parameters<typeof grok.createGrokBuild>[0], 'auth' | 'provider'>
      if (route.kind === 'vertex') {
        if (!route.accessToken) {
          throw new AgentError(
            "Grok Build on Vertex AI sends a bearer of its own: set the route's accessToken",
          )
        }
        const { project, region } = grokVertexChat(route)
        access = {
          auth: { [grok.VERTEX_TOKEN_ENV]: route.accessToken },
          provider: grok.vertexProvider(project, region),
        }
      } else {
        access = {
          auth,
          ...onGateway(route, {
            vercel: { provider: { ...grok.AI_GATEWAY_PROVIDER, baseUrl: vercelApi(env).openai } },
            openrouter: { provider: grok.OPENROUTER_PROVIDER },
          }),
        }
      }
      return grok.createGrokBuild({
        ...access,
        model,
        ...(plugins.length
          ? {
              pluginDirs: plugins.map((p) => p.dir),
              pluginMcpServers: plugins.flatMap((p) =>
                p.servers.map((s) => s.slice(p.name.length + 1)),
              ),
            }
          : {}),
        ...effortOf(effort),
        ...servers<Record<string, unknown>>(mcpServers),
        requireCredentialBrokering: true,
      }) as unknown as HarnessV1
    }
  }
}

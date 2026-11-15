import type { HarnessV1 } from '@ai-sdk/harness'
import {
  type AdapterInput,
  type AgentLog,
  type AgentRoute,
  type AgentSession,
  agent,
  catalogAdapter,
  errorText,
  type HarnessSpec,
  type PlacedPlugin,
} from '@reeval/agents'
import { WORKSPACE_DIR } from '@reeval/sandbox-docker'
import { runnerOf } from '../environment/runner.ts'
import { brokerToken } from '../environment/token.ts'
import { SANDBOX_ACCESS_TOKEN, type SandboxAdc, type VertexSettings } from '../gateway/vertex.ts'
import { modelLimits } from '../prices.ts'
import { capabilitiesOf, runsAgent, sandboxKind, suggestedSandbox } from '../sandbox/kinds.ts'
import { hasNetworkSession, InfraError, type Sandbox } from '../sandbox/types.ts'
import { startEnv } from '../startup.ts'
import type { AgentHarnessDescriptor, SandboxDescriptor } from '../types.ts'
import { type Agent, agentAuth, agentFor, authHint, writePluginFiles } from './agents.ts'
import { WORKSPACE_PATH } from './transcript.ts'
import type { Harness } from './types.ts'

/** The route's service account, written beside the workspace; returns where it is. */
async function writeAdc(sandbox: Sandbox, adc: SandboxAdc, log: AgentLog): Promise<string> {
  await sandbox.writeFile(`../${adc.file}`, adc.content)
  const credentialsFile = `${sandbox.workdir.replace(/[\\/][^\\/]*$/, '')}/${adc.file}`
  log.log('env', `Vertex AI service account → ${credentialsFile}`)
  return credentialsFile
}

/**
 * Why `agent` can't run in `sandbox`: its kind has no harness session, can't keep the agent's
 * credential out of it, or runs a platform the agent's bootstrap has no build for.
 */
export function agentSandboxProblem(agent: Agent, sandbox: SandboxDescriptor): string | undefined {
  const fits = runsAgent(agent.platforms)
  const can = capabilitiesOf(sandbox)
  if (fits(can)) return undefined
  // Only a sandbox with a harness session runs the bootstrap, so only its platform matters.
  const lacks = [
    ...(can.harnessSession ? [] : ['has no harness session']),
    ...(can.brokers ? [] : [`can't keep ${agent.credential} out of it`]),
    ...(!can.harnessSession || agent.platforms.includes(can.platform)
      ? []
      : [`runs ${can.platform}, not ${agent.platforms.join(' or ')}`]),
  ]
  const fix = suggestedSandbox(fits)
  return `The ${agent.name} harness can't run in the ${sandboxKind(sandbox).provider(sandbox)} sandbox, which ${lacks.join(' and ')}: ${fix ? `set sandbox: ${fix} for this eval, or ` : ''}use fakeHarness() with fakeSandbox()`
}

/** The core's spec of a harness descriptor: which agent, on which model. */
export function harnessSpec(descriptor: AgentHarnessDescriptor): HarnessSpec {
  const { kind, model, effort } = descriptor
  if (kind === 'cursor') {
    return {
      kind,
      model,
      ...(effort ? { effort } : {}),
      ...(descriptor.params ? { params: descriptor.params } : {}),
    }
  }
  if (kind === 'claude-code') return { kind, model, ...(effort ? { effort } : {}) }
  return { kind, model, ...(effort ? { effort } : {}) } as HarnessSpec
}

/**
 * Where the descriptor's gateway sends its model calls. On Vertex, the attempt's `vertex()`
 * settings, the service account written beside the workspace, and the placeholder the gateway
 * swaps for the minted token.
 */
export function harnessRoute(
  descriptor: AgentHarnessDescriptor,
  vertex?: VertexSettings,
  credentialsFile?: string,
): AgentRoute {
  const { gateway } = descriptor
  if (gateway === 'vertex' && vertex) {
    return {
      kind: 'vertex',
      ...vertex,
      ...(credentialsFile ? { credentialsFile } : {}),
      accessToken: SANDBOX_ACCESS_TOKEN,
    }
  }
  if (gateway === 'vercel' || gateway === 'openrouter') return { kind: gateway }
  return { kind: 'direct' }
}

/** The fetch the adapter's own calls from the host take: Cursor's through a filled key's filler. */
async function adapterFetch(descriptor: AgentHarnessDescriptor): Promise<{ fetch?: typeof fetch }> {
  if (descriptor.kind !== 'cursor') return {}
  return (await import('./cursor-catalog.ts')).cursorFetch()
}

/** The descriptor's adapter as an attempt builds it, for a check that reads its configuration. */
export async function harnessAdapter(
  descriptor: AgentHarnessDescriptor,
  input: AdapterInput & {
    plugins?: readonly PlacedPlugin[]
    vertex?: VertexSettings
    credentialsFile?: string
  },
): Promise<HarnessV1> {
  const { plugins = [], vertex, credentialsFile, ...adapter } = input
  return catalogAdapter({
    ...adapter,
    harness: harnessSpec(descriptor),
    route: harnessRoute(descriptor, vertex, credentialsFile),
    plugins,
    env: startEnv(),
    describeModel: modelLimits,
    ...(await adapterFetch(descriptor)),
    requireBrokering: true,
  })
}

/** A real agent through `@reeval/agents`, in a sandbox that gives it a harness session. */
export function createAgentHarness(
  descriptor: AgentHarnessDescriptor,
  sandbox: SandboxDescriptor,
  vertex?: VertexSettings,
): Harness {
  const catalog = agentFor(descriptor, vertex)
  const problem = agentSandboxProblem(catalog, sandbox)
  if (problem) throw new InfraError(problem)
  return {
    async start(sandbox, signal, { skills, mcp, plugins }, log) {
      const auth = agentAuth(catalog)
      const adc = catalog.adc ? await writeAdc(sandbox, catalog.adc, log) : undefined
      for (const path of await writePluginFiles(sandbox, catalog, plugins)) {
        log.log('env', `plugin settings → ${path}`)
      }
      if (!hasNetworkSession(sandbox)) {
        throw new InfraError(`The ${catalog.name} harness got a sandbox with no harness session`)
      }
      let stopToken = () => {}
      if (catalog.token) {
        try {
          stopToken = await brokerToken(catalog.token, sandbox.network, {
            onRefresh: (t) =>
              log.log(
                'broker',
                `access token refreshed, valid until ${new Date(t.expiresAt).toISOString()}`,
              ),
            onError: (error) =>
              log.log('broker', `access token refresh failed, retrying: ${errorText(error)}`),
          })
        } catch (error) {
          throw new InfraError(
            `Couldn't mint an access token from ${catalog.credential} for ${catalog.name}: ${errorText(error)}. Run gcloud auth application-default login, or set GOOGLE_APPLICATION_CREDENTIALS.`,
          )
        }
        log.log('broker', `gateway adds an access token from ${catalog.credential}`)
      }
      const { runner, session } = runnerOf(sandbox)
      let started: AgentSession
      try {
        started = await agent({
          harness: harnessSpec(descriptor),
          route: harnessRoute(descriptor, vertex, adc),
          runner,
          session,
          credentials: auth,
          // A sandbox whose image wasn't baked with this build of the CLI installs it here.
          install: 'auto',
          workDir: WORKSPACE_DIR,
          skills,
          mcp,
          plugins,
          env: startEnv(),
          describeModel: modelLimits,
          ...(await adapterFetch(descriptor)),
          // A sandbox whose network can't broker the key must not get it.
          requireBrokering: true,
          traffic: {
            statuses: () => sandbox.brokeredStatuses?.() ?? [],
            servedModels: () => sandbox.servedRequests?.() ?? [],
          },
          authHint: (message, refused) => authHint(catalog, message, refused),
          workspace: WORKSPACE_PATH,
          raw: Boolean(process.env.REEVAL_RAW_TRANSCRIPT),
          log,
          signal,
          onEvent: (event) => {
            if (event.type === 'warning') log.log('harness', event.message)
          },
        }).start()
      } catch (error) {
        stopToken()
        throw error
      }
      return {
        send: (prompt, turnSignal) => started.send(prompt, { signal: turnSignal }).result,
        stopped: (note) => started.stopped(note),
        salvage: () => started.salvage(),
        close: () => started.close().finally(stopToken),
      }
    },
  }
}

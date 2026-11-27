// The options every harness shares, and which harness can enforce each. It imports nothing, so a
// plan can check them without loading a harness (the `@reeval/agents/options` subpath).
import type { AgentKind } from './catalog/entry.ts'

/** The built-in tools `tools` names, by the AI SDK's common names. */
export const TOOL_NAMES = ['read', 'write', 'edit', 'bash', 'grep', 'glob', 'webSearch'] as const

export type ToolName = (typeof TOOL_NAMES)[number]

/**
 * What a harness runs with, in the same words on every harness. A harness takes only the ones it
 * can enforce.
 */
export type HarnessOptions<Tool extends ToolName = ToolName> = {
  /** The model the harness runs. */
  model: string
  /**
   * Added to the harness's own system prompt, or, on a harness that has no way to add to it, to
   * its global rules or to each prompt.
   */
  instructions?: string
  /**
   * Replaces the harness's own system prompt. The environment's rules and skills are still added,
   * and OpenCode still adds its sections on the model and its tools.
   */
  systemPrompt?: string
  /**
   * The only built-in tools the agent has, by the AI SDK's common names: `read`, `write`, `edit`,
   * `bash`, `grep`, `glob` and `webSearch`. Its other built-in tools are off; skills and MCP
   * tools stay. OpenCode keeps `write` and `edit` only together.
   */
  tools?: Tool[]
  /**
   * The shell commands the agent may run, as prefixes: a command runs when it is one of them or
   * starts with one and a space, and the harness refuses every other. A prefix has no shell
   * operators: Claude Code and pi refuse any command with one, and OpenCode runs a chained
   * command only when each part is allowed. An allowed command still runs what it runs, such as
   * a script the agent wrote.
   */
  commands?: string[]
}

export type SharedOption = Exclude<keyof HarnessOptions, 'model'>

export const HARNESS_OPTIONS = ['instructions', 'systemPrompt', 'tools', 'commands'] as const

/**
 * The options each harness can enforce, the tools its `tools` can keep, and the tools it keeps
 * only together (OpenCode's `write` asks its `edit` permission). Codex's tools are feature
 * switches, not a list it filters, and its approval rules can't refuse a command no rule names;
 * the other CLIs have no system prompt, tool filter or command filter of their own.
 */
export const OPTION_SUPPORT = {
  cursor: { options: ['instructions'] },
  'claude-code': {
    options: ['instructions', 'systemPrompt', 'tools', 'commands'],
    tools: TOOL_NAMES,
  },
  antigravity: { options: ['instructions'] },
  opencode: {
    options: ['instructions', 'systemPrompt', 'tools', 'commands'],
    tools: TOOL_NAMES,
    together: [['write', 'edit']],
  },
  goose: { options: ['instructions'] },
  pi: {
    options: ['instructions', 'systemPrompt', 'tools', 'commands'],
    tools: ['read', 'write', 'edit', 'bash', 'grep', 'glob'],
  },
  codex: { options: ['instructions', 'systemPrompt'] },
  fx: { options: ['instructions'] },
  'grok-build': { options: ['instructions'] },
} as const satisfies Record<AgentKind, Support>

type Support = {
  options: readonly SharedOption[]
  tools?: readonly ToolName[]
  together?: readonly (readonly ToolName[])[]
}

/** What a `commands` prefix can't hold: every harness refuses a command with any of these. */
const SHELL_OPERATORS = /[;&|`$()<>\n\r\\]/

/** Why `kind` can't run with `options`, naming it `name`, or undefined when it can. */
export function optionProblem(
  kind: AgentKind,
  options: Omit<HarnessOptions, 'model'>,
  name: string = kind,
): string | undefined {
  const support: Support = OPTION_SUPPORT[kind]
  for (const key of HARNESS_OPTIONS) {
    if (options[key] !== undefined && !support.options.includes(key)) {
      return `${name} can't enforce ${key}; it takes ${support.options.join(', ')}`
    }
  }
  const missing = options.tools?.find((t) => !support.tools?.includes(t))
  if (missing) {
    return `${name} has no ${missing} tool to keep; its tools are ${support.tools?.join(', ')}`
  }
  for (const group of support.together ?? []) {
    const kept = group.filter((t) => options.tools?.includes(t))
    if (kept.length > 0 && kept.length < group.length) {
      return `${name} keeps ${group.join(' and ')} only together; tools has ${kept.join(', ')}`
    }
  }
  const padded = options.commands?.find((c) => c === '' || c.trim() !== c)
  if (padded !== undefined) {
    return `${name}'s commands prefix ${JSON.stringify(padded)} is empty or has spaces around it`
  }
  const operator = options.commands?.find((c) => SHELL_OPERATORS.test(c))
  if (operator !== undefined) {
    return `${name}'s commands prefix ${JSON.stringify(operator)} has a shell operator; each is one plain command`
  }
  if (options.commands && options.tools && !options.tools.includes('bash')) {
    return `${name}'s commands run in its bash tool, so tools must include bash`
  }
  return undefined
}

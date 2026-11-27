// reeval's CLI as data: every command, subcommand, flag and help line. `reeval` builds its parser
// (`cli-parse.ts`) and its `--help` from it, and `reeval explain` checks each suggested verify
// command against it, so a model can't invent a flag.

import { matchesEvalId, namesEvalFile } from './engine/files.ts'

export type FlagSpec = {
  type: 'string' | 'boolean'
  short?: string
  multiple?: boolean
  /** A string flag that may be given with no value (`--resume`). */
  optional?: boolean
}

export const FLAGS = {
  config: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean' },
  verbose: { type: 'boolean', short: 'v', multiple: true },
  trace: { type: 'boolean' },
  keep: { type: 'string' },
  images: { type: 'boolean' },
  staging: { type: 'boolean' },
  bundles: { type: 'boolean' },
  json: { type: 'boolean' },
  md: { type: 'boolean' },
  all: { type: 'boolean' },
  record: { type: 'boolean' },
  artifacts: { type: 'string' },
  'allow-incomplete': { type: 'boolean' },
  'skip-secret-scan': { type: 'boolean' },
  limit: { type: 'string' },
  'fail-on-regression': { type: 'boolean' },
  trials: { type: 'string' },
  run: { type: 'string' },
  profile: { type: 'string' },
  'dry-run': { type: 'boolean' },
  force: { type: 'boolean' },
  provider: { type: 'string' },
  'older-than': { type: 'string' },
  registry: { type: 'string' },
  push: { type: 'boolean' },
  concurrency: { type: 'string' },
  ui: { type: 'string' },
  'log-order': { type: 'string' },
  'log-prefix': { type: 'string' },
  'output-logs': { type: 'string' },
  tag: { type: 'string', multiple: true },
  trait: { type: 'string', multiple: true },
  cell: { type: 'string', multiple: true },
  http: { type: 'boolean' },
  port: { type: 'string' },
  host: { type: 'string', multiple: true },
  out: { type: 'string' },
  format: { type: 'string' },
  'no-scratch': { type: 'boolean' },
  'no-open': { type: 'boolean' },
  token: { type: 'string' },
  schema: { type: 'boolean' },
  rebuild: { type: 'boolean' },
  vs: { type: 'string' },
  eval: { type: 'string' },
  save: { type: 'boolean' },
  context: { type: 'boolean' },
  'no-cache': { type: 'boolean' },
  yes: { type: 'boolean', short: 'y' },
  agent: { type: 'string' },
  bare: { type: 'boolean' },
  online: { type: 'boolean' },
  offline: { type: 'boolean' },
  debug: { type: 'boolean' },
  'all-branches': { type: 'boolean' },
  'push-only': { type: 'boolean' },
  issue: { type: 'boolean' },
  last: { type: 'boolean' },
  resume: { type: 'string', optional: true },
  'retry-errors': { type: 'string', optional: true },
  detach: { type: 'boolean', short: 'd' },
  events: { type: 'boolean' },
  'events-file': { type: 'string' },
  'events-url': { type: 'string' },
  bundle: { type: 'string' },
  cloud: { type: 'boolean' },
  local: { type: 'boolean' },
  mode: { type: 'string' },
  'from-env': { type: 'boolean' },
  project: { type: 'string' },
  org: { type: 'string' },
  download: { type: 'boolean' },
  'no-wait': { type: 'boolean' },
  full: { type: 'boolean' },
  public: { type: 'boolean' },
  list: { type: 'boolean' },
  revoke: { type: 'string' },
  grader: { type: 'string', multiple: true },
  since: { type: 'string' },
  at: { type: 'string' },
  original: { type: 'boolean' },
  regrades: { type: 'boolean' },
} as const satisfies Record<string, FlagSpec>

export type FlagName = keyof typeof FLAGS

export const isFlagName = (name: string): name is FlagName => name in FLAGS

type FlagValue<S extends FlagSpec> = S extends { type: 'string' }
  ? S extends { multiple: true }
    ? string[]
    : string
  : S extends { multiple: true }
    ? boolean[]
    : boolean

/** The parsed flags, keyed by their spec name (`dry-run`, `no-cache`); unset flags are absent. */
export type Flags = { -readonly [K in FlagName]?: FlagValue<(typeof FLAGS)[K]> }

/** One row of a command's options in its help. */
export type OptionHelp = {
  /** The flags as help shows them: `--profile <name>`, `-v, --verbose`. */
  flags: string
  /** What the flag does; a second line follows a `\n`. */
  help: string
  /** Left out of every help and the docs; the flag still parses and works. */
  hidden?: true
}

export type CommandSpec = {
  flags: FlagName[]
  /** How many positional arguments it takes; `Infinity` for filters or SQL. */
  positionals: number
  /** What follows `reeval` on its usage line: the command path and its arguments. */
  usage: string
  /** What it does in one line: its row in `reeval --help` or its group's help. */
  summary: string
  /** Its own help's description, when that says more than the summary. */
  description?: string
  /** A command that takes an action word (`set <name>`, `list`): each action's usage and summary. */
  actions?: [usage: string, summary: string][]
  options?: OptionHelp[]
  /** Its heading in `reeval --help`. */
  group?: string
  /** Left out of `reeval --help` and the docs; it still parses, runs and prints its own `--help`. */
  hidden?: true
  /** It only names subcommands: `reeval image` alone runs nothing. */
  groupOnly?: true
  /** Its arguments may hold a secret, so a refusal counts them instead of repeating them. */
  secretArgs?: true
  /** It takes a recorded run by ref, so its help says how to name one. */
  runRef?: true
  sub?: Record<string, Omit<CommandSpec, 'sub' | 'group'>>
}

export const RUN_FLAGS: FlagName[] = [
  'profile',
  'dry-run',
  'json',
  'force',
  'trials',
  'concurrency',
  'registry',
  'tag',
  'trait',
  'cell',
  'record',
  'ui',
  'log-order',
  'log-prefix',
  'output-logs',
  'verbose',
  'resume',
  'retry-errors',
  'detach',
  'events',
  'events-file',
  'events-url',
  'bundle',
  'cloud',
  'local',
  'download',
]

const HISTORY_STORE: OptionHelp[] = [
  { flags: '--offline', help: "Read the history store's local copy without pulling" },
  { flags: '--all-branches', help: "Include every branch's runs, not only HEAD's" },
  { flags: '--profile <name>', help: 'Profile whose history store to use' },
]

const CLOUD_TARGET: OptionHelp[] = [
  { flags: '--org <slug>', help: 'Org slug or id (default: linked)' },
  { flags: '--project <slug>', help: 'Project slug or id (default: linked)' },
]

const KEY_TARGET: OptionHelp[] = [
  { flags: '--org <slug>', help: 'Org slug or id (default: linked)' },
  { flags: '--project <slug>', help: "The project's own key, overriding the org's" },
  { flags: '--json', help: 'Output list as JSON' },
]

export const COMMANDS: Record<string, CommandSpec> = {
  init: {
    flags: ['agent', 'yes', 'bare', 'force', 'dry-run'],
    positionals: 1,
    group: 'Get started',
    usage: 'init [dir]',
    summary: 'Create a reeval project',
    description: 'Create a reeval project in dir (default: .)',
    options: [
      {
        flags: '--agent <name>',
        help: 'Agent: cursor, claude-code, antigravity, opencode, goose, pi,\ncodex, fx or grok-build (default: cursor)',
      },
      { flags: '-y, --yes', help: 'Accept all defaults without prompting' },
      { flags: '--bare', help: 'Write only reeval.config.ts, .gitignore and package.json' },
      { flags: '--force', help: 'Overwrite an existing reeval.config.ts' },
      { flags: '--dry-run', help: 'Show what would be written' },
    ],
  },
  doctor: {
    flags: ['online', 'json'],
    positionals: 0,
    group: 'Get started',
    usage: 'doctor',
    summary: 'Check your setup and print fixes',
    options: [
      { flags: '--online', help: 'Also test each API key with a live request' },
      { flags: '--json', help: 'Output as JSON' },
    ],
  },
  run: {
    flags: RUN_FLAGS,
    positionals: Number.POSITIVE_INFINITY,
    group: 'Run evals',
    usage: 'run [filter...]',
    summary: 'Run evals',
    description: 'Run evals matching path, name or cell filters',
    options: [
      {
        flags: '--profile <name>',
        help: 'Profile from reeval.config.ts (default: defaultProfile)',
      },
      { flags: '--dry-run', help: 'Show the plan without running' },
      { flags: '--json', help: 'Print results as JSON on stdout' },
      { flags: '--force', help: 'Run even when over budget.trials' },
      { flags: '--trials <n>', help: 'Trials per cell' },
      { flags: '--concurrency <n>', help: 'Trials at once (default: 8)' },
      {
        flags: '--registry <prefix>',
        help: 'Registry to pull sandbox images from before building',
      },
      { flags: '--tag <tag>', help: 'Only evals with this tag; !tag excludes; repeatable' },
      { flags: '--trait <key=value>', help: 'Only cells with this environment trait; repeatable' },
      { flags: '--cell <key>', help: 'Only this cell key or cell#n trial id; repeatable' },
      { flags: '--record', help: 'Also record the run to the history folder' },
      { flags: '--resume [ref]', help: 'Resume a stopped or interrupted run (default: newest)' },
      {
        flags: '--retry-errors [ref]',
        help: "Re-run a finished run's infra errors (default: newest)",
      },
      { flags: '--ui <mode>', help: 'Output UI: plain or agent (default: auto)' },
      {
        flags: '--log-order <order>',
        help: 'Log order: stream or grouped (default: grouped in CI, else stream)',
      },
      { flags: '--log-prefix <prefix>', help: 'Detail line prefix: task or none (default: task)' },
      {
        flags: '--output-logs <level>',
        help: 'Detail lines to print: full, errors-only or none (default: none)',
      },
      { flags: '-v, --verbose', help: "Print each trial's trace" },
      { flags: '-vv', help: 'Also print raw payloads and keep every trace' },
      { flags: '-d, --detach', help: 'Run in the background; reeval attach follows it' },
      { flags: '--events', help: 'Write events to .reeval/events/<run>.ndjson', hidden: true },
      { flags: '--events-file <file>', help: 'Write events to file', hidden: true },
      { flags: '--events-url <url>', help: 'POST events to url', hidden: true },
      { flags: '--bundle <file>', help: 'Run a bundle made with reeval bundle', hidden: true },
      { flags: '--cloud', help: 'Run in reeval cloud', hidden: true },
      { flags: '--download', help: "Download a cloud run's files when it ends", hidden: true },
      { flags: '--local', help: 'Run locally, ignoring cloud settings', hidden: true },
    ],
  },
  attach: {
    flags: ['ui', 'log-order', 'log-prefix', 'output-logs', 'download', 'profile'],
    positionals: 1,
    group: 'Run evals',
    usage: 'attach [run|file|url]',
    summary: "Follow a run's output",
    description: "Follow a run's output (default: the run in progress)",
    options: [
      { flags: '--ui --log-order --log-prefix --output-logs', help: 'Same as reeval run' },
      { flags: '--download', help: "Download a cloud run's files when it ends", hidden: true },
      { flags: '--profile <name>', help: 'Profile whose history takes the download', hidden: true },
    ],
  },
  login: {
    flags: [],
    positionals: 0,
    group: 'Cloud',
    hidden: true,
    usage: 'login',
    summary: 'Sign in to reeval cloud',
  },
  logout: {
    flags: [],
    positionals: 0,
    group: 'Cloud',
    hidden: true,
    usage: 'logout',
    summary: 'Sign out of reeval cloud',
  },
  whoami: {
    flags: ['json'],
    positionals: 0,
    group: 'Cloud',
    hidden: true,
    usage: 'whoami',
    summary: 'Show the signed-in user',
    options: [{ flags: '--json', help: 'Output as JSON' }],
  },
  link: {
    flags: ['org', 'project', 'yes'],
    positionals: 0,
    group: 'Cloud',
    hidden: true,
    usage: 'link',
    summary: 'Link this project to a reeval cloud project',
    options: [
      { flags: '--org <slug>', help: 'Org slug or id' },
      { flags: '--project <slug>', help: 'Project slug or id' },
      { flags: '-y, --yes', help: 'Replace an existing link without prompting' },
    ],
  },
  cloud: {
    flags: [],
    positionals: 0,
    group: 'Cloud',
    hidden: true,
    groupOnly: true,
    usage: 'cloud',
    summary: 'Manage cloud secrets, keys, runs and uploads',
    sub: {
      secrets: {
        flags: ['mode', 'host', 'from-env', 'org', 'project', 'json'],
        positionals: 3,
        secretArgs: true,
        usage: 'cloud secrets',
        summary: 'Manage cloud eval secrets',
        actions: [
          ['set <name>', 'Set a cloud eval secret (value from stdin or prompt)'],
          ['delete <name>', 'Delete a cloud eval secret'],
          ['list', 'List cloud eval secrets'],
        ],
        options: [
          {
            flags: '--mode <mode>',
            help: 'Exposure: brokered, sandbox or readable (default: brokered)',
          },
          { flags: '--host <host>', help: 'Host a brokered secret may reach; repeatable' },
          { flags: '--from-env', help: 'Read the value from the local environment' },
          ...CLOUD_TARGET,
          { flags: '--json', help: 'Output list as JSON' },
        ],
      },
      provider: {
        flags: ['org', 'project', 'json'],
        positionals: 3,
        secretArgs: true,
        usage: 'cloud provider',
        summary: 'Manage AI provider keys',
        actions: [
          ['set <provider>', 'Set an AI provider key (value from stdin or prompt)'],
          ['delete <provider>', 'Delete an AI provider key'],
          ['list', 'List AI provider keys'],
        ],
        options: KEY_TARGET,
      },
      gateway: {
        flags: ['org', 'project', 'json'],
        positionals: 3,
        secretArgs: true,
        usage: 'cloud gateway',
        summary: 'Manage model gateway keys',
        actions: [
          ['set <gateway>', 'Set a model gateway key (value from stdin or prompt)'],
          ['delete <gateway>', 'Delete a model gateway key'],
          ['list', 'List model gateway keys'],
        ],
        options: KEY_TARGET,
      },
      push: {
        flags: [
          'org',
          'project',
          'no-wait',
          'skip-secret-scan',
          'profile',
          'offline',
          'all-branches',
          'out',
          'json',
          'artifacts',
          'allow-incomplete',
        ],
        positionals: 1,
        runRef: true,
        usage: 'cloud push [run]',
        summary: 'Upload a recorded run to the cloud studio',
        description: 'Upload a recorded run to the cloud studio (default: latest)',
        options: [
          { flags: '--no-wait', help: 'Return once uploaded' },
          { flags: '--out <file>', help: 'Write the archive to a file instead of uploading' },
          {
            flags: '--artifacts <level>',
            help: 'Artifacts to include: all, evidence, failures or none',
          },
          { flags: '--allow-incomplete', help: 'Allow an incomplete run with --artifacts' },
          { flags: '--skip-secret-scan', help: 'Upload despite secret scan findings' },
          { flags: '--json', help: 'Output as JSON' },
          ...CLOUD_TARGET,
          ...HISTORY_STORE,
        ],
      },
      run: {
        flags: [],
        positionals: 2,
        usage: 'cloud run',
        summary: 'Manage cloud runs',
        actions: [['cancel <run>', 'Cancel a cloud run']],
      },
    },
  },
  bundle: {
    flags: ['profile', 'trials', 'tag', 'trait', 'out'],
    positionals: Number.POSITIVE_INFINITY,
    group: 'Run evals',
    hidden: true,
    usage: 'bundle [filter...]',
    summary: "Package a run's plan and files as a .tar.gz",
    options: [
      { flags: '--profile <name>', help: 'Profile to plan with' },
      { flags: '--trials --tag --trait', help: 'Same as reeval run' },
      { flags: '--out <file>', help: 'Output file (default: <project>.bundle.tar.gz)' },
    ],
  },
  clean: {
    flags: ['keep', 'images', 'staging', 'bundles'],
    positionals: 0,
    group: 'Run evals',
    usage: 'clean',
    summary: 'Remove local debug data, snapshots and event streams',
    options: [
      { flags: '--keep <n>', help: "Keep the newest n runs' data (default: 0)" },
      { flags: '--images', help: 'Also remove unused images reeval built' },
      { flags: '--staging', help: "Also remove stopped runs' staging" },
      { flags: '--bundles', help: 'Also remove extracted bundles', hidden: true },
    ],
  },
  record: {
    flags: ['artifacts', 'allow-incomplete', 'skip-secret-scan', 'profile'],
    positionals: Number.POSITIVE_INFINITY,
    runRef: true,
    group: 'Results',
    usage: 'record [run...]',
    summary: 'Copy runs to the history folder',
    description: 'Copy runs to the history folder (default: latest)',
    options: [
      {
        flags: '--artifacts <level>',
        help: 'Artifacts to include: all, evidence, failures or none',
      },
      { flags: '--allow-incomplete', help: 'Allow an incomplete run with --artifacts' },
      { flags: '--skip-secret-scan', help: 'Record despite secret scan findings' },
      { flags: '--profile <name>', help: 'Profile whose history store to use' },
    ],
  },
  history: {
    flags: ['limit', 'all', 'json', 'original', 'profile', 'offline', 'all-branches'],
    positionals: Number.POSITIVE_INFINITY,
    group: 'Results',
    usage: 'history [filter]',
    summary: 'Show pass/fail per eval over recent runs',
    options: [
      { flags: '--limit <n>', help: 'Runs to show' },
      { flags: '--all', help: 'Include unrecorded runs' },
      { flags: '--json', help: 'Output as JSON' },
      { flags: '--original', help: 'Show grades as recorded, without regrades' },
      ...HISTORY_STORE,
    ],
  },
  show: {
    flags: [
      'json',
      'md',
      'trace',
      'out',
      'original',
      'regrades',
      'profile',
      'offline',
      'all-branches',
    ],
    positionals: 1,
    runRef: true,
    group: 'Results',
    usage: 'show [run]',
    summary: 'Show a run',
    options: [
      { flags: '--md', help: 'Output as Markdown' },
      { flags: '--json', help: 'Output the record as JSON' },
      { flags: '--trace', help: 'Write a Perfetto trace of the run' },
      { flags: '--out <file>', help: 'Trace output file (default: .reeval/traces/<run>.json)' },
      { flags: '--original', help: 'Show grades as recorded, without regrades' },
      { flags: '--regrades', help: "List the run's regrades" },
      ...HISTORY_STORE,
    ],
  },
  export: {
    flags: ['format', 'out', 'profile', 'offline', 'all-branches'],
    positionals: 1,
    runRef: true,
    group: 'Results',
    usage: 'export [run]',
    summary: 'Export a run as an archive, or in another format',
    description: 'Export a run as its archive zip, or with --format in another format',
    options: [
      { flags: '--format <name>', help: 'atif: an ATIF trajectory per trial' },
      {
        flags: '--out <path>',
        help: 'The zip or a directory for it, or the directory for --format (default: <run>.zip, <run>.<format>)',
      },
      ...HISTORY_STORE,
    ],
  },
  compare: {
    flags: [
      'md',
      'json',
      'fail-on-regression',
      'verbose',
      'original',
      'profile',
      'offline',
      'all-branches',
    ],
    positionals: 2,
    runRef: true,
    group: 'Results',
    usage: 'compare [base] [head]',
    summary: 'Compare two runs',
    description: 'Compare two runs (default base: nearest recorded ancestor)',
    options: [
      { flags: '--md', help: 'Output as Markdown' },
      { flags: '--json', help: 'Output as JSON' },
      { flags: '--fail-on-regression', help: 'Exit 1 on a regression' },
      { flags: '-v, --verbose', help: 'Also show lift, effort and variant comparisons' },
      { flags: '--original', help: 'Compare grades as recorded, without regrades' },
      ...HISTORY_STORE,
    ],
  },
  regrade: {
    flags: ['tag', 'grader', 'since', 'at', 'dry-run', 'yes', 'profile', 'all-branches'],
    positionals: Number.POSITIVE_INFINITY,
    group: 'Results',
    usage: 'regrade [filter...]',
    summary: "Grade recorded trials again with today's graders",
    description:
      "Grade recorded trials again with today's graders (default: each eval's latest run)",
    options: [
      { flags: '--tag <tag>', help: 'Only evals with this tag; !tag excludes; repeatable' },
      { flags: '--grader <name>', help: 'Only this grader; repeatable' },
      { flags: '--since <duration>', help: 'Every recorded run in the last duration, e.g. 30d' },
      { flags: '--at <ref>', help: 'The runs at a git ref: a tag, a branch or a SHA' },
      { flags: '--dry-run', help: 'Show the plan without regrading' },
      { flags: '-y, --yes', help: 'Regrade without asking' },
      { flags: '--profile <name>', help: 'Profile whose graders and judge to use' },
      { flags: '--all-branches', help: "Include every branch's runs, not only HEAD's" },
    ],
  },
  checkout: {
    flags: ['profile', 'offline', 'all-branches'],
    positionals: 2,
    runRef: true,
    group: 'Results',
    usage: 'checkout [run] [dir]',
    summary: "Check out a run's code as a git worktree",
    description: "Check out a run's code as a git worktree (default dir: .reeval/checkouts/<run>)",
    options: HISTORY_STORE,
  },
  sync: {
    flags: ['profile', 'debug', 'push-only'],
    positionals: Number.POSITIVE_INFINITY,
    runRef: true,
    group: 'Results',
    usage: 'sync [run...]',
    summary: 'Sync runs with the history store',
    options: [
      { flags: '--debug', help: "Also download the runs' debug data (default: latest)" },
      { flags: '--push-only', help: 'Upload only' },
      { flags: '--profile <name>', help: 'Profile whose history store to use' },
    ],
  },
  query: {
    flags: ['json', 'schema', 'rebuild', 'run', 'profile', 'offline'],
    positionals: Number.POSITIVE_INFINITY,
    group: 'Results',
    usage: 'query [sql | view]',
    summary: 'Query run history with SQL or a named view',
    description: 'Query run history with SQL or a named view (no argument lists the views)',
    options: [
      { flags: '--run <id|last>', help: 'Bind a run id to :run' },
      { flags: '--json', help: 'Output as JSON' },
      { flags: '--schema', help: 'List every table and column' },
      { flags: '--rebuild', help: 'Rebuild the history database' },
      { flags: '--offline', help: "Read the history store's local copy without pulling" },
      { flags: '--profile <name>', help: 'Profile whose history store to use' },
    ],
  },
  explain: {
    flags: [
      'vs',
      'eval',
      'json',
      'md',
      'save',
      'push',
      'context',
      'dry-run',
      'no-cache',
      'profile',
      'offline',
      'all-branches',
    ],
    positionals: 1,
    runRef: true,
    group: 'Results',
    usage: 'explain [run]',
    summary: 'Explain a run with an LLM',
    options: [
      {
        flags: '--vs <run>',
        help: 'Run to compare with, or none (default: nearest recorded ancestor)',
      },
      { flags: '--eval <filter>', help: 'Only matching evals' },
      { flags: '--save', help: "Save the analysis to the run's history folder" },
      { flags: '--push', help: 'With --save, also upload it to the cloud studio' },
      { flags: '--context', help: 'Print the digest for your own agent, without calling a model' },
      { flags: '--dry-run', help: 'Show the digest size and cache key' },
      { flags: '--json', help: 'Output as JSON' },
      { flags: '--md', help: 'Output as Markdown' },
      { flags: '--no-cache', help: 'Call the model even when cached' },
      ...HISTORY_STORE,
    ],
  },
  report: {
    flags: ['out', 'json', 'last', 'issue', 'yes'],
    positionals: 1,
    runRef: true,
    group: 'Results',
    usage: 'report [run]',
    summary: 'Collect a redacted bug report',
    options: [
      { flags: '--out <dir|file>', help: 'Output path (default: .reeval/reports)' },
      { flags: '--json', help: 'Output as JSON' },
      { flags: '--last', help: 'Report the last failed command' },
      { flags: '--issue', help: 'Open a GitHub issue' },
      { flags: '-y, --yes', help: 'File the issue without prompting' },
    ],
  },
  mcp: {
    flags: ['http', 'port', 'host', 'token', 'profile', 'offline', 'all-branches'],
    positionals: 0,
    group: 'Studio and agents',
    usage: 'mcp',
    summary: 'Serve run history over MCP',
    description: 'Serve run history over MCP (stdio)',
    options: [
      { flags: '--http', help: 'Serve over HTTP at /mcp instead' },
      { flags: '--port <n>', help: 'HTTP port (default: 4986)' },
      { flags: '--host <addr>', help: 'HTTP address to listen on (default: 127.0.0.1)' },
      { flags: '--token <value>', help: 'Require this bearer token with --http' },
      ...HISTORY_STORE,
    ],
  },
  studio: {
    flags: ['port', 'no-open', 'no-scratch', 'profile'],
    positionals: 1,
    runRef: true,
    group: 'Studio and agents',
    usage: 'studio [run]',
    summary: 'Open runs in the studio, or share them',
    description: 'Open local runs in the studio (default: newest)',
    options: [
      { flags: '--port <n>', help: 'First port to try (default: 4984)' },
      { flags: '--no-open', help: 'Print the URL without opening a browser' },
      { flags: '--no-scratch', help: 'Hide unrecorded runs' },
      { flags: '--profile <name>', help: 'Profile whose history store to use' },
    ],
    sub: {
      share: {
        flags: [
          'full',
          'public',
          'list',
          'revoke',
          'json',
          'skip-secret-scan',
          'org',
          'project',
          'profile',
          'offline',
          'all-branches',
        ],
        positionals: 1,
        runRef: true,
        usage: 'studio share [run]',
        summary: "Share a run's report with your org",
        description: "Share a run's report with your org (default: latest)",
        options: [
          { flags: '--full', help: 'Include trajectories and artifacts' },
          { flags: '--public', help: 'Allow anyone with the link' },
          { flags: '--list', help: 'List shares' },
          { flags: '--revoke <id>', help: 'Revoke a share' },
          { flags: '--json', help: 'Output as JSON' },
          { flags: '--skip-secret-scan', help: 'Push despite secret scan findings' },
          ...CLOUD_TARGET,
          ...HISTORY_STORE,
        ],
      },
    },
  },
  image: {
    flags: [],
    positionals: 0,
    group: 'Images',
    groupOnly: true,
    usage: 'image',
    summary: 'Build, list and clean sandbox images',
    sub: {
      build: {
        flags: ['profile', 'dry-run', 'force', 'registry', 'push'],
        positionals: Number.POSITIVE_INFINITY,
        usage: 'image build [filter...]',
        summary: 'Build the sandbox images the evals need',
        options: [
          { flags: '--profile <name>', help: 'Profile to plan with' },
          { flags: '--force', help: 'Rebuild every image' },
          { flags: '--registry <prefix>', help: 'Registry to pull images from before building' },
          { flags: '--push', help: 'Push built images to --registry' },
          { flags: '--dry-run', help: 'List images without building' },
        ],
      },
      list: {
        flags: ['profile', 'json'],
        positionals: Number.POSITIVE_INFINITY,
        usage: 'image list [filter...]',
        summary: 'List saved boat() and daytona() image snapshots',
        options: [
          { flags: '--profile <name>', help: 'Profile to plan with' },
          { flags: '--json', help: 'Output as JSON' },
        ],
      },
      clean: {
        flags: ['profile', 'provider', 'older-than', 'all', 'dry-run'],
        positionals: 0,
        usage: 'image clean',
        summary: 'Delete unused boat() and daytona() image snapshots',
        options: [
          { flags: '--profile <name>', help: 'Profile to plan with' },
          { flags: '--provider <name>', help: 'Only boat or daytona' },
          {
            flags: '--older-than <duration>',
            help: 'Only snapshots unused this long (default: 14d)',
          },
          { flags: '--all', help: 'Also delete snapshots in use' },
          { flags: '--dry-run', help: 'List what would be deleted' },
        ],
      },
    },
  },
}

/** Flags every command takes; without `--config`, `reeval` finds the nearest config. */
export const GLOBAL: FlagName[] = ['config', 'help', 'version']

/**
 * What to use instead of a flag on a command that doesn't take it, by `<command> --<flag>`, for
 * the flags people look for on the wrong command.
 */
export const INSTEAD: Record<string, string> = {
  'reeval run --trace':
    "-vv keeps every trial's trace.ndjson in .reeval/debug, and reeval show --trace writes a run's timeline for ui.perfetto.dev",
}

/** What reeval is, in one line: bare `reeval`, `--help` and the package's description say it. */
export const TAGLINE = 'Evaluation runner for SDKs, CLIs, MCP servers, and docs.'

const RUN_REF = 'A run is latest, latest~N, a run id or its prefix, or a git SHA prefix.'

const COLUMN = 28

/** One help row: the left side padded to the column, or on its own line when too long. */
const row = (left: string, right: string): string[] => {
  const head = `  ${left}`
  const [first = '', ...rest] = right.split('\n')
  const more = rest.map((line) => `${' '.repeat(COLUMN)}${line}`)
  return head.length < COLUMN - 1
    ? [`${head.padEnd(COLUMN)}${first}`, ...more]
    : [head, `${' '.repeat(COLUMN)}${first}`, ...more]
}

/** The global options, as `reeval --help` ends with them. */
export const GLOBAL_HELP = [
  'Global options:',
  ...row('--config <path>', 'Config file (default: nearest reeval.config.ts)'),
  ...row('-h, --help', 'Show help'),
  ...row('--version', 'Print the version'),
].join('\n')

type HelpSpec = Omit<CommandSpec, 'sub' | 'group'>

const visibleSubs = (spec: CommandSpec) =>
  Object.entries(spec.sub ?? {}).filter(([, sub]) => !sub.hidden)

/** A subcommand's rows in its group's help: one per action, else one. */
const subRows = (name: string, sub: HelpSpec) => {
  const usage = sub.usage.slice(name.length + 1)
  return sub.actions
    ? sub.actions.flatMap(([action, summary]) => row(`${usage} ${action}`, summary))
    : row(usage, sub.summary)
}

/**
 * A command's own help without the title: its usage, description, options and subcommands, as
 * the CLI reference shows it. `path` is `['run']` or `['image', 'build']`.
 */
export function commandHelpBody(path: string[]): string {
  const [name = '', subName = ''] = path
  const command = COMMANDS[name]
  if (!command) throw new Error(`no reeval command ${name}`)
  const spec: HelpSpec = (subName && command.sub?.[subName]) || command
  const options = (spec.options ?? []).filter((o) => !o.hidden)
  const subs = spec === command ? visibleSubs(command) : []
  const lines: string[] = []
  if (spec.actions) {
    lines.push('Usage:')
    for (const [action, summary] of spec.actions)
      lines.push(...row(`reeval ${spec.usage} ${action}`, summary))
  } else {
    const rest = command.groupOnly && spec === command ? ' <command>' : ''
    lines.push(`Usage: reeval ${spec.usage}${rest}${options.length ? ' [options]' : ''}`, '')
    lines.push(spec.description ?? spec.summary)
  }
  if (options.length) {
    lines.push('', 'Options:')
    for (const option of options) lines.push(...row(option.flags, option.help))
  }
  if (subs.length) {
    lines.push('', 'Commands:')
    for (const [, sub] of subs) lines.push(...subRows(name, sub))
  }
  if (command.groupOnly && spec === command) {
    lines.push('', `Run reeval ${name} <command> --help for a command's options.`)
  }
  return lines.join('\n')
}

/** `reeval --help`: every command that isn't hidden, one row each under its group, then the global flags. */
export function helpText(version: string): string {
  const groups = new Map<string, string[]>()
  for (const [, spec] of Object.entries(COMMANDS)) {
    if (spec.hidden) continue
    const group = spec.group ?? 'Commands'
    groups.set(group, [...(groups.get(group) ?? []), ...row(spec.usage, spec.summary)])
  }
  const sections = [...groups].map(([group, rows]) => [`${group}:`, ...rows].join('\n'))
  return `reeval ${version} — ${TAGLINE}

Usage: reeval <command> [options]

${sections.join('\n\n')}

${GLOBAL_HELP}

Run reeval <command> --help for a command's options.
`
}

/**
 * `reeval <command> [sub] --help`: that command's own help, hidden or not, or the whole of
 * `reeval --help` for a command it doesn't know.
 */
export function commandHelpText(version: string, path: string[]): string {
  const [name = '', subName = ''] = path
  const spec = COMMANDS[name]
  if (!spec) return helpText(version)
  const sub = spec.sub?.[subName]
  const runRef = sub ? sub.runRef : spec.runRef
  return `reeval ${version} — ${TAGLINE}

${commandHelpBody(sub ? [name, subName] : [name])}
${runRef ? `\n${RUN_REF}\n` : ''}`
}

/** The flags a command takes that its help leaves out. */
export function hiddenFlags(spec: HelpSpec): FlagName[] {
  const hidden = (spec.options ?? []).filter((o) => o.hidden).map((o) => o.flags)
  return spec.flags.filter((flag) =>
    hidden.some((flags) => new RegExp(`--${flag}(?![\\w-])`).test(flags)),
  )
}

/** Splits a command line on whitespace, honoring single and double quotes. */
export function shellWords(line: string): string[] | null {
  const words: string[] = []
  let word = ''
  let quote: string | null = null
  let started = false
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null
      else word += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      started = true
    } else if (/\s/.test(ch)) {
      if (started || word) words.push(word)
      word = ''
      started = false
    } else {
      word += ch
      started = true
    }
  }
  if (quote) return null
  if (started || word) words.push(word)
  return words
}

const RUNNERS = [['npx'], ['pnpm', 'exec'], ['pnpm'], ['npm', 'exec', '--'], ['yarn']]

/** An eval as `reeval run` selects it: by file path, by id, by name (with its groups) or cell, and by tag. */
export type SelectableEval = {
  file: string
  name: string
  /** The record's eval id (`file › group › … › name`), when the digest has it. */
  id?: string
  tags: string[]
  cells: string[]
}

/**
 * Why `line` isn't a valid reeval command line, or null when it is. It may chain `reeval` commands with
 * `&&` or `;` and start with `npx` or `pnpm`; `reeval query <name>` must name a view or table in
 * `tables`, when given; `reeval run` and `reeval image build` must select at least one of `evals`, when
 * given, with their filters (`reeval run` also with `--tag`s).
 */
export function checkCommand(
  line: string,
  tables?: readonly string[],
  evals?: readonly SelectableEval[],
): string | null {
  const segments = line.split(/\s*(?:&&|;)\s*/).filter((s) => s.trim())
  if (segments.length === 0) return 'empty command'
  for (const segment of segments) {
    const problem = checkOne(segment, tables, evals)
    if (problem) return problem
  }
  return null
}

/**
 * Why `filters` and `tags` select nothing among `evals`, or null. As `reeval run` does: a filter that
 * names an eval file or a directory of them picks files, any other picks evals by id, and the two narrow each
 * other; every `--tag` must hold (`!tag` excludes).
 */
export function selectionProblem(
  name: string,
  evals: readonly SelectableEval[],
  filters: string[],
  tags: string[],
): string | null {
  const known = [...new Set(evals.flatMap((e) => e.tags))].sort()
  for (const tag of tags) {
    const bare = tag.replace(/^!/, '')
    if (!known.includes(bare)) {
      return `${name} --tag ${tag}: no eval in the run has the tag ${bare} (tags: ${known.join(', ') || 'none'})`
    }
  }
  const byName = (e: SelectableEval, f: string) =>
    e.id ? matchesEvalId(e.id, f) : matchesEvalId(e.name, f)
  const bare = (f: string) => f.replace(/^\.\//, '').replace(/\/$/, '')
  const picks = (e: SelectableEval, f: string) =>
    namesEvalFile(e.file, f) || e.file === bare(f) || e.file.startsWith(`${bare(f)}/`)
  const paths = filters.filter((f) => evals.some((e) => picks(e, f)))
  const names = filters.filter((f) => !paths.includes(f))
  const unknown = names.filter((f) => !evals.some((e) => byName(e, f)))
  if (unknown.length) {
    return `${name}: filter ${unknown.map((f) => `"${f}"`).join(', ')} matches no eval file or eval id in the run`
  }
  const selected = evals.filter(
    (e) =>
      tags.every((t) => (t.startsWith('!') ? !e.tags.includes(t.slice(1)) : e.tags.includes(t))) &&
      (!paths.length || paths.some((f) => picks(e, f))) &&
      (!names.length || names.some((f) => byName(e, f))),
  )
  return selected.length
    ? null
    : `${name} ${[...filters, ...tags.map((t) => `--tag ${t}`)].join(' ')} selects no eval in the run`
}

function checkOne(
  segment: string,
  tables?: readonly string[],
  evals?: readonly SelectableEval[],
): string | null {
  if (/[|<>`$]/.test(segment.replace(/"[^"]*"|'[^']*'/g, ''))) {
    return `"${segment}" pipes or substitutes; verify commands are plain reeval commands`
  }
  let words = shellWords(segment)
  if (!words) return `unbalanced quotes in "${segment}"`
  while (words[0] && /^[A-Z_][A-Z0-9_]*=/.test(words[0])) words = words.slice(1)
  for (const runner of RUNNERS) {
    if (runner.every((w, i) => words?.[i] === w)) {
      words = words.slice(runner.length)
      break
    }
  }
  if (words[0] !== 'reeval' && words[0] !== 're') return `"${segment}" isn't a reeval command`
  const [, command, ...rest] = words
  if (!command || command.startsWith('-')) {
    return command && ['--help', '-h', '--version'].includes(command)
      ? null
      : 'no reeval command given'
  }
  const spec = COMMANDS[command]
  if (!spec)
    return `reeval ${command} isn't a reeval command (commands: ${Object.keys(COMMANDS).join(', ')})`
  let args = rest
  let name = `reeval ${command}`
  let target: Omit<CommandSpec, 'sub'> = spec
  if (spec.sub) {
    const sub = args[0] && spec.sub[args[0]]
    if (sub) {
      name = `${name} ${args[0]}`
      target = sub
      args = args.slice(1)
    } else if (command === 'image')
      return 'reeval image needs a subcommand: reeval image build, list or clean'
    else if (command === 'cloud')
      return 'reeval cloud needs a subcommand: reeval cloud secrets, provider, gateway, push or run'
  }
  const allowed = new Set<string>([...target.flags, ...GLOBAL])
  const positionals: string[] = []
  const tags: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string
    if (arg === '--') {
      positionals.push(...args.slice(i + 1))
      break
    }
    if (/^-v+$/.test(arg) && allowed.has('verbose')) continue
    if (arg.startsWith('-') && arg !== '-') {
      const eq = arg.indexOf('=')
      const raw = arg.startsWith('--') ? arg.slice(2, eq === -1 ? undefined : eq) : arg.slice(1)
      const flag = arg.startsWith('--')
        ? raw
        : Object.entries(FLAGS).find(([, s]) => 'short' in s && s.short === raw)?.[0]
      if (!flag || !isFlagName(flag)) return `${arg} isn't a reeval flag`
      if (!allowed.has(flag)) return `--${flag} isn't an option of ${name}`
      const spec = FLAGS[flag]
      const type = spec.type
      if (type === 'string' && eq === -1) {
        const value = args[i + 1]
        if (value === undefined || value.startsWith('--')) {
          if (!('optional' in spec && spec.optional)) return `--${flag} needs a value`
        } else {
          i++
          if (flag === 'tag') tags.push(value)
        }
      } else if (flag === 'tag' && eq !== -1) tags.push(arg.slice(eq + 1))
      if (type === 'boolean' && eq !== -1) return `--${flag} takes no value`
      continue
    }
    positionals.push(arg)
  }
  if (positionals.length > target.positionals) {
    return `${name} takes at most ${target.positionals} argument${target.positionals === 1 ? '' : 's'} (got ${positionals.join(' ')})`
  }
  if (evals && (name === 'reeval run' || name === 'reeval image build')) {
    const problem = selectionProblem(name, evals, positionals, tags)
    if (problem) return problem
  }
  if (command === 'query' && tables && positionals.length === 1) {
    const text = positionals[0] as string
    if (/^[A-Za-z_]\w*$/.test(text) && !tables.includes(text)) {
      return `reeval query ${text}: no view or table named ${text} (views and tables: ${tables.join(', ')})`
    }
  }
  return null
}

/** One line per command, for the analysis prompt and `--context`. */
export function commandSummary(): string[] {
  const line = (name: string, spec: Omit<CommandSpec, 'sub'>) =>
    `reeval ${name}${spec.positionals ? ' [args]' : ''}${spec.flags.length ? ` ${spec.flags.map((f) => `--${f}${FLAGS[f].type === 'string' ? ('optional' in FLAGS[f] && FLAGS[f].optional ? ' [v]' : ' <v>') : ''}`).join(' ')}` : ''}`
  return Object.entries(COMMANDS).flatMap(([name, spec]) => [
    ...(name === 'image' || name === 'cloud' ? [] : [line(name, spec)]),
    ...Object.entries(spec.sub ?? {}).map(([sub, s]) => line(`${name} ${sub}`, s)),
  ])
}

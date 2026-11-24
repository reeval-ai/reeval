// What bare `reeval` prints: the mark, the version, who's signed in and the linked project, and a
// few commands to try. `reeval --help` lists every command.
import { existsSync } from 'node:fs'
import { COMMANDS, TAGLINE } from './cli-spec.ts'
import { linkedProject, projectDirFor } from './cloud-project.ts'
import { cloudUrl } from './cloud-run.ts'
import { configPathFor } from './config.ts'
import { CLOUD_TOKEN_VAR, storedUser } from './login/credentials.ts'
import { type ColorDepth, colors } from './ui/colors.ts'

const MARK = [
  '        ▄▄████▄▄',
  '   ▄▄██████████████▄▄',
  '▄████▀▀████████████████▄',
  '███   ▄▄██████████▀▀▀███',
  '███   ███▀▀██▀▀    ▄▄███',
  '███   ███▄     ▄▄███████',
  '███   ██████████████████',
  '▀████▄█████████████████▀',
  '   ▀▀██████████████▀▀',
  '        ▀▀████▀▀',
]
const MARK_WIDTH = 24
/** The narrowest terminal the mark and the text beside it fit on. */
const MARK_COLUMNS = 90

export type HomeStatus = {
  /** `REEVAL_TOKEN`, or `reeval login`'s sign-in with its email (null when the file has none). */
  signedIn: { token: true } | { email: string | null } | null
  /** The cloud project `.reeval/project.json` links to: its name, or its id in a link without one. */
  project: string | null
  /** Whether there's a config for the commands here to read. */
  config: boolean
}

export type HomeTerminal = { tty: boolean; color: boolean; columns: number; depth?: ColorDepth }

/** Who's signed in, the linked project and the config, from local files only; a problem reads as none. */
export async function homeStatus(
  configFlag: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<HomeStatus> {
  let signedIn: HomeStatus['signedIn'] = env[CLOUD_TOKEN_VAR]?.trim() ? { token: true } : null
  let project: string | null = null
  let config = false
  try {
    const user = signedIn ? null : await storedUser(cloudUrl(env), env)
    if (user) signedIn = { email: user.email || null }
  } catch {}
  try {
    const path = configPathFor(configFlag)
    config = !!path && existsSync(path)
    const link = await linkedProject(projectDirFor(config ? path : undefined))
    project = link ? (link.projectName ?? link.projectId) : null
  } catch {}
  return { signedIn, project, config }
}

/** Whether a command is in `reeval --help`: the home screen suggests no hidden one. */
const listed = (command: string) => !COMMANDS[command]?.hidden

export function homeScreen(
  version: string,
  status: HomeStatus,
  term: HomeTerminal,
  shown: (command: string) => boolean = listed,
): string {
  const c = colors(term.color, term.depth)
  const doctor: [string, string] = ['reeval doctor', 'Check your environment setup']
  const tryNext: [string, string][] = status.config
    ? [
        ['reeval run', 'Run the evals'],
        ['reeval show', "The latest run's results"],
        ['reeval studio', 'Browse your runs in the studio'],
        doctor,
      ]
    : [
        ['reeval init', 'Set up a project here'],
        doctor,
        ...(status.signedIn || !shown('login')
          ? []
          : [['reeval login', 'Sign in to the cloud platform'] as [string, string]]),
      ]
  const signedIn = status.signedIn
  const hint = (command: string) => (shown(command) ? `reeval ${command}` : undefined)
  const rows: [string, string?][] = [
    ...(!signedIn
      ? shown('login')
        ? [['Not signed in', hint('login')] as [string, string?]]
        : []
      : 'token' in signedIn
        ? [[`Signed in with ${CLOUD_TOKEN_VAR}`] as [string]]
        : signedIn.email
          ? [[`Signed in as ${signedIn.email}`] as [string]]
          : [['Signed in', hint('whoami')] as [string, string?]]),
    ...(status.project
      ? [[`Linked to project ${status.project}`] as [string]]
      : shown('link')
        ? [['No project linked', hint('link')] as [string, string?]]
        : []),
  ]
  const width =
    Math.max(...[...tryNext, ...rows.filter(([, hint]) => hint)].map(([left]) => left.length)) + 4
  const line = ([left, hint]: [string, string?], paint = (s: string) => s) =>
    hint ? `  ${paint(left.padEnd(width))}${c.dim(hint)}` : `  ${paint(left)}`
  const about = [`${c.bold('reeval')} ${c.dim(`v${version}`)}`, TAGLINE]
  const head =
    term.tty && term.columns >= MARK_COLUMNS
      ? [
          '',
          ...MARK.map((mark, i) => {
            const text = about[i - 4]
            return text ? `${c.brand(mark.padEnd(MARK_WIDTH))}    ${text}` : c.brand(mark)
          }),
        ]
      : about
  return [
    ...head,
    '',
    ...(rows.length ? [...rows.map((row) => line(row, c.muted)), ''] : []),
    c.bold('Try next'),
    ...tryNext.map((row) => line(row)),
    '',
    `Run ${c.bold('reeval --help')} to see every command`,
  ].join('\n')
}

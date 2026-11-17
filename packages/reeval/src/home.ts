// What bare `reeval` prints: the mark, the version, who's signed in and the linked project, and a
// few commands to try. `reeval --help` lists every command.
import { existsSync } from 'node:fs'
import { linkedProject, projectDirFor } from './cloud-project.ts'
import { cloudUrl } from './cloud-run.ts'
import { configPathFor } from './config.ts'
import { CLOUD_TOKEN_VAR, storedUser } from './login/credentials.ts'
import { colors } from './ui/colors.ts'

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
const TAGLINE = 'Evaluation runner for SDKs, CLIs, MCP servers, and docs.'

export type HomeStatus = {
  /** `REEVAL_TOKEN`, or `reeval login`'s sign-in with its email (null when the file has none). */
  signedIn: { token: true } | { email: string | null } | null
  /** The cloud project `.reeval/project.json` links to, by id: the file holds no name. */
  project: string | null
  /** Whether there's a config for the commands here to read. */
  config: boolean
}

export type HomeTerminal = { tty: boolean; color: boolean; columns: number }

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
    project = (await linkedProject(projectDirFor(config ? path : undefined)))?.projectId ?? null
  } catch {}
  return { signedIn, project, config }
}

export function homeScreen(version: string, status: HomeStatus, term: HomeTerminal): string {
  const c = colors(term.color)
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
        ['reeval login', 'Sign in to the cloud platform'],
      ]
  const signedIn = status.signedIn
  const rows: [string, string?][] = [
    !signedIn
      ? ['Not signed in', 'reeval login']
      : 'token' in signedIn
        ? [`Signed in with ${CLOUD_TOKEN_VAR}`]
        : [
            signedIn.email
              ? `Signed in as ${signedIn.email}`
              : 'Signed in (no email stored locally)',
          ],
    status.project ? [`Linked to project ${status.project}`] : ['No project linked', 'reeval link'],
  ]
  const width =
    Math.max(...[...tryNext, ...rows.filter(([, hint]) => hint)].map(([left]) => left.length)) + 4
  const line = ([left, hint]: [string, string?]) =>
    hint ? `  ${left.padEnd(width)}${c.dim(hint)}` : `  ${left}`
  const about = [`${c.bold('reeval')} ${c.dim(`v${version}`)}`, TAGLINE]
  const head =
    term.tty && term.columns >= MARK_COLUMNS
      ? MARK.map((mark, i) => {
          const text = about[i - 4]
          return text ? `${c.teal(mark.padEnd(MARK_WIDTH))}    ${text}` : c.teal(mark)
        })
      : about
  return [
    ...head,
    '',
    ...rows.map(line),
    '',
    c.bold('Try next'),
    ...tryNext.map(line),
    '',
    `Run ${c.bold('reeval --help')} to see every command`,
  ].join('\n')
}

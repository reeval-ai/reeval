// What bare `reeval` prints: the mark, the version, who's signed in and the project here, and a
// few commands to try. `reeval --help` lists every command.
import { existsSync } from 'node:fs'
import { cloudUrl } from './cloud-run.ts'
import { configLabel, configPathFor } from './config.ts'
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
const MARK_COLUMNS = 72

export type HomeStatus = {
  /** Who the cloud calls sign in as: an email, `REEVAL_TOKEN`, or null when signed out. */
  signedIn: string | null
  /** The config the commands here read, relative to here, or null when there's none. */
  config: string | null
}

export type HomeTerminal = { tty: boolean; color: boolean; columns: number }

/** Who's signed in and the nearest config, from local files only; a problem reads as neither. */
export async function homeStatus(
  configFlag: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<HomeStatus> {
  let signedIn: string | null = env[CLOUD_TOKEN_VAR]?.trim() ? CLOUD_TOKEN_VAR : null
  let config: string | null = null
  try {
    const user = signedIn ? null : await storedUser(cloudUrl(env), env)
    signedIn ??= user?.email || user?.name || null
  } catch {}
  try {
    const path = configPathFor(configFlag)
    config = path && existsSync(path) ? configLabel(path) : null
  } catch {}
  return { signedIn, config }
}

export function homeScreen(version: string, status: HomeStatus, term: HomeTerminal): string {
  const c = colors(term.color)
  const tryNext: [string, string][] = status.config
    ? [
        ['reeval run', 'Run the evals'],
        ['reeval show', "The latest run's results"],
        ['reeval studio', 'Browse your runs in the studio'],
        ['reeval doctor', 'Check Docker, images and keys'],
      ]
    : [
        ['reeval init', 'Set up a project here'],
        ['reeval doctor', 'Check Node, Docker and keys'],
        ['reeval login', 'Sign in to the cloud platform'],
      ]
  const rows: [string, string][] = [
    ['Signed in', status.signedIn ?? `no ${c.dim('(reeval login)')}`],
    ['Project', status.config ?? `none here ${c.dim('(reeval init)')}`],
  ]
  const about = [
    `${c.bold('reeval')} ${c.dim(`v${version}`)}`,
    'Eval runner for coding agents',
    '',
    ...rows.map(([k, v]) => `${c.dim(k.padEnd(11))}${v}`),
  ]
  const head =
    term.tty && term.columns >= MARK_COLUMNS
      ? MARK.map((line, i) => {
          const text = about[i - 2] ?? ''
          return text ? `${c.teal(line.padEnd(MARK_WIDTH))}    ${text}` : c.teal(line)
        })
      : about
  const width = Math.max(...tryNext.map(([cmd]) => cmd.length)) + 4
  return [
    ...head,
    '',
    c.bold('Try next'),
    ...tryNext.map(([cmd, what]) => `  ${cmd.padEnd(width)}${c.dim(what)}`),
    '',
    `Run ${c.bold('reeval --help')} to see every command`,
  ].join('\n')
}

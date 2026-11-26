import { isAcmeError } from '@acme/core'
import { CommanderError } from 'commander'
import { createProgram, type ProgramDeps } from './program.ts'

/**
 * Runs the CLI and returns its exit code: 0 for success, 1 for an API or runtime error, 2 for a
 * usage error.
 *
 * @param argv - The arguments after the program name.
 * @param deps - The services and the output streams.
 */
export async function run(argv: string[], deps: ProgramDeps): Promise<number> {
  const program = createProgram(deps)
  try {
    await program.parseAsync(argv, { from: 'user' })
    return 0
  } catch (error) {
    if (error instanceof CommanderError) return error.exitCode === 0 ? 0 : 2
    if (isAcmeError(error)) {
      deps.stderr(
        program.opts<{ json?: boolean }>().json === true
          ? `${JSON.stringify({ error: { code: error.code, message: error.message } }, null, 2)}\n`
          : `error: ${error.code}: ${error.message}\n`,
      )
      return 1
    }
    deps.stderr(`error: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}

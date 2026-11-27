import type { EvalSpec } from 'reeval'
import { inDiff, succeeded } from 'reeval/graders'
import { environments, GUIDES } from './envs.ts'
import { patchOf } from './repo.ts'
import { TASKS } from './tasks.ts'

// Can an agent contribute to reeval, and do AGENTS.md and the feature contract help? Each task is
// a merged change asked for again from its parent commit. The change's own tests are placed after
// the turn, so the agent never sees them; the repo's build, lint, typecheck and docs check run on
// what it left, and graders read their exit codes.

const FOOTER =
  "\n\nThe repository is checked out with its dependencies installed. Make the change as you would for a pull request to this repository. You don't need to commit."

/** What review runs on the change, in order. */
const CHECKS = [
  { label: 'pnpm build', run: 'pnpm build' },
  { label: 'pnpm lint', run: 'pnpm lint' },
  { label: 'typecheck', run: 'pnpm --filter reeval typecheck' },
  { label: 'pnpm docs:check', run: 'pnpm docs:check' },
]

/** The eval for the task with this id in tasks.ts. */
export function contributes(id: string): EvalSpec {
  const task = TASKS.find((t) => t.id === id)
  if (!task) throw new Error(`no task ${id} in tasks.ts`)
  const { baseline, variant, newGuides } = environments(task)
  const variants = newGuides ? [variant, newGuides] : [variant]
  return {
    timeout: '45m',
    compare: { baseline: baseline, variants },
    graders: [
      inDiff('packages/reeval/test/**'),
      inDiff('docs/**'),
      ...task.touches.map((paths) => inDiff(paths)),
      ...CHECKS.map(({ label }) => succeeded(label)),
      succeeded('hidden tests'),
    ],
    task: async (c) => {
      // The merged change, for reeval.oracle.config.ts's fake agent to apply. A real agent never
      // gets it.
      if (c.trial.cell.harness.startsWith('fake')) {
        await c.writeFile('~/oracle.patch', patchOf(task.pr.parent, task.pr.sha, GUIDES))
      }
      await c.send(task.prompt + FOOTER)
      for (const { label, run } of CHECKS) await c.exec(run, { label })
      for (const [path, text] of Object.entries(task.hidden.files)) await c.writeFile(path, text)
      await c.exec(task.hidden.run, { label: 'hidden tests' })
    },
  }
}

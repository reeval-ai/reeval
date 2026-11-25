import { type EvalSpec, expect } from 'reeval'
import { arms, GUIDES } from './envs.ts'
import { patchOf } from './repo.ts'
import { TASKS } from './tasks.ts'

// Can an agent contribute to reeval, and do AGENTS.md and the feature contract help? Each task is
// a merged change asked for again from its parent commit. The change's own tests are placed after
// the turn, so the agent never sees them; the repo's build, lint, typecheck and docs check run on
// what it left.

const FOOTER =
  "\n\nThe repository is checked out with its dependencies installed. Make the change as you would for a pull request to this repository. You don't need to commit."

/** The eval for the task with this id in tasks.ts. */
export function contributes(id: string): EvalSpec {
  const task = TASKS.find((t) => t.id === id)
  if (!task) throw new Error(`no task ${id} in tasks.ts`)
  const { control, variant, newGuides } = arms(task)
  const variants = newGuides ? [variant, newGuides] : [variant]
  return {
    timeout: '45m',
    compare: { control: control, variants, gate: 'observe' },
    task: async (c) => {
      // The merged change, for reeval.oracle.config.ts's fake agent to apply. A real agent never
      // gets it.
      if (c.attempt.cell.harness.startsWith('fake')) {
        await c.writeFile('~/oracle.patch', patchOf(task.pr.parent, task.pr.sha, GUIDES))
      }
      await c.send(task.prompt + FOOTER)

      expect(c, 'adds or updates tests').toHaveChanged('packages/reeval/test/**')
      expect(c, 'updates the docs').toHaveChanged('docs/**')
      for (const t of task.touches) expect(c, t.label).toHaveChanged(t.paths)

      await expect(c.exec('pnpm build'), 'pnpm build').toSucceed()
      await expect(c.exec('pnpm lint'), 'pnpm lint').toSucceed()
      await expect(c.exec('pnpm --filter reeval typecheck'), 'typecheck').toSucceed()
      await expect(c.exec('pnpm docs:check'), 'pnpm docs:check').toSucceed()

      for (const [path, text] of Object.entries(task.hidden.files)) await c.writeFile(path, text)
      await expect(c.exec(task.hidden.run), "the merged change's tests").toSucceed()
    },
  }
}

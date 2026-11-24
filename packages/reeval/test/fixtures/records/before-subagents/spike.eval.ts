import { writeFileSync } from 'node:fs'
import { defineEnvironment, evaluate, expect } from 'reeval'

const env = defineEnvironment('puzzle', ({ directory }) => ({ files: directory('./project') }))

evaluate('subagents', { environments: env, timeout: '10m' }, async (c) => {
  await c.send(
    'Delegate this work to two subagents with your subagent (agent spawning) tool, run in parallel, and wait for both. ' +
      'Subagent 1: create src/add.js exporting `export const add = (a, b) => a + b` and run `node -e "import(\'./src/add.js\').then(m=>console.log(m.add(2,3)))"`. ' +
      'Subagent 2: create src/mul.js exporting `export const mul = (a, b) => a * b` and run the same kind of check. ' +
      'Do not write the files yourself. When both are done, reply with one line saying what each subagent reported.',
  )
  await expect(c, 'add').toHaveFile('src/add.js', /add/)
  await expect(c, 'mul').toHaveFile('src/mul.js', /mul/)
  const tar = await c.exec(
    'cd / && tar czf - $(ls -d $HOME/.claude $HOME/.codex $HOME/.cursor ${CODEX_HOME:-/nonexistent} /tmp/claude-* 2>/dev/null) 2>/dev/null | base64 -w0',
  )
  writeFileSync(
    `out/${process.env.SPIKE_TAG ?? 'home'}.tgz`,
    Buffer.from(tar.stdout.trim(), 'base64'),
  )
})

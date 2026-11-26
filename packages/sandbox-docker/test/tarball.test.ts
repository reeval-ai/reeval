import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  readTar,
  readTarStream,
  TAR_END,
  type TarEntry,
  tarEntry,
  writeTar,
} from '../src/tarball.ts'

const file = (path: string): TarEntry => ({
  type: 'file',
  path,
  mode: 0o644,
  mtime: 0,
  data: Buffer.from(path),
})

test('readTar leaves out absolute and climbing paths and names them, but not the archive root', () => {
  const unsafe: string[] = []
  const entries = readTar(
    writeTar([
      { type: 'dir', path: '.', mode: 0o755, mtime: 0 },
      file('ok/a.txt'),
      file('../up.txt'),
      file('ok/../../up.txt'),
      file('/abs.txt'),
      file('back\\slash.txt'),
      file(
        `${'deep/'.repeat(30)}../../../../../../../../../../../../../../../../../../../../../../../../../../../../../../../x`,
      ),
    ]),
    unsafe,
  )
  assert.deepEqual(
    entries.map((e) => e.path),
    ['ok/a.txt'],
  )
  assert.equal(unsafe.length, 5)
  assert.ok(unsafe.includes('../up.txt') && unsafe.includes('/abs.txt'))
})

test('readTarStream reads what readTar does from chunks of any size, long names and links included', async () => {
  const entries: TarEntry[] = [
    { type: 'dir', path: 'src', mode: 0o755, mtime: 0 },
    file('src/a.txt'),
    { ...file(`${'long/'.repeat(40)}name.txt`), data: Buffer.alloc(1500, 7) },
    { type: 'symlink', path: 'link', mode: 0o777, mtime: 0, target: 'src/a.txt' },
    file('../up.txt'),
  ]
  const tar = writeTar(entries)
  const whole = readTar(tar)
  for (const size of [1, 7, 512, 4096, tar.length]) {
    async function* chunks() {
      for (let at = 0; at < tar.length; at += size) yield tar.subarray(at, at + size)
    }
    const unsafe: string[] = []
    const streamed: TarEntry[] = []
    for await (const e of readTarStream(chunks(), unsafe)) streamed.push(e)
    assert.deepEqual(streamed, whole, `chunks of ${size}`)
    assert.deepEqual(unsafe, ['../up.txt'])
  }
  const parts = Buffer.concat([...entries.slice(0, 2).map(tarEntry), TAR_END])
  assert.deepEqual(readTar(parts), readTar(writeTar(entries.slice(0, 2))))
})

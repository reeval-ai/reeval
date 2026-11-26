// A small tar reader and writer for snapshots: it reads what GNU tar, BSD tar and BusyBox
// write (ustar, GNU long names, pax headers) and writes ustar with pax headers for long paths.
// Paths that are absolute or climb out with `..` never come out of `readTar`.
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

export type TarEntry =
  | { type: 'file'; path: string; mode: number; mtime: number; data: Buffer }
  | { type: 'dir'; path: string; mode: number; mtime: number }
  | { type: 'symlink'; path: string; mode: number; mtime: number; target: string }

const BLOCK = 512

const text = (b: Buffer, at: number, len: number) => {
  const field = b.subarray(at, at + len)
  const end = field.indexOf(0)
  return (end < 0 ? field : field.subarray(0, end)).toString('utf8')
}

function octal(b: Buffer, at: number, len: number): number {
  // GNU's base-256 form, for values too large for the octal digits.
  if ((b[at] ?? 0) & 0x80) {
    let n = (b[at] ?? 0) & 0x7f
    for (let i = 1; i < len; i++) n = n * 256 + (b[at + i] ?? 0)
    return n
  }
  const digits = text(b, at, len).trim()
  return digits ? Number.parseInt(digits, 8) : 0
}

/** `a/./b/` as `a/b`; null for a path that's absolute, empty or climbs out with `..`. */
export function safeTarPath(path: string): string | null {
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.includes('\\')) return null
  const parts = path.split('/').filter((p) => p !== '' && p !== '.')
  if (!parts.length || parts.includes('..')) return null
  return parts.join('/')
}

function paxRecords(data: Buffer): Record<string, string> {
  const out: Record<string, string> = {}
  let at = 0
  while (at < data.length) {
    const space = data.indexOf(0x20, at)
    if (space < 0) break
    const len = Number(data.subarray(at, space).toString())
    if (!(len > 0)) break
    const record = data.subarray(space + 1, at + len - 1).toString('utf8')
    const eq = record.indexOf('=')
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1)
    at += len
  }
  return out
}

/** What a tar's headers carry over to the entry after them: long names and pax records. */
type Pending = { longName?: string; longLink?: string; pax: Record<string, string> }

/** A header's data size, or null where the archive ends or can't be read on. */
function sizeOf(h: Buffer, pending: Pending): number | null {
  if (h.every((byte) => byte === 0)) return null
  const size = pending.pax.size !== undefined ? Number(pending.pax.size) : octal(h, 124, 12)
  return Number.isSafeInteger(size) && size >= 0 ? size : null
}

/**
 * The entry header `h` with its `data` makes, or a hard link's target path, or null for a header
 * that only carries over to the next one, a type kept out, or an unsafe path (pushed to `unsafe`).
 */
function entryOf(
  h: Buffer,
  data: Buffer,
  pending: Pending,
  unsafe?: string[],
): TarEntry | { link: string; path: string; mode: number; mtime: number } | null {
  const type = String.fromCharCode(h[156] ?? 0)
  if (type === 'L') {
    pending.longName = text(data, 0, data.length)
    return null
  }
  if (type === 'K') {
    pending.longLink = text(data, 0, data.length)
    return null
  }
  if (type === 'x') {
    pending.pax = { ...pending.pax, ...paxRecords(data) }
    return null
  }
  if (type === 'g') return null
  const { pax } = pending
  const prefix = text(h, 257, 6).startsWith('ustar') ? text(h, 345, 155) : ''
  const name = text(h, 0, 100)
  const raw = pax.path ?? pending.longName ?? (prefix ? `${prefix}/${name}` : name)
  const link = pax.linkpath ?? pending.longLink ?? text(h, 157, 100)
  const mtime = pax.mtime !== undefined ? Math.floor(Number(pax.mtime)) : octal(h, 136, 12)
  pending.longName = pending.longLink = undefined
  pending.pax = {}
  const path = safeTarPath(raw)
  if (!path) {
    if (raw.split('/').some((p) => p !== '' && p !== '.')) unsafe?.push(raw)
    return null
  }
  const mode = octal(h, 100, 8) & 0o7777
  if (type === '0' || type === '\0' || type === '7') {
    return { type: 'file', path, mode, mtime, data: Buffer.from(data) }
  }
  if (type === '1') {
    const target = safeTarPath(link)
    return target ? { link: target, path, mode, mtime } : null
  }
  if (type === '2') return { type: 'symlink', path, mode, mtime, target: link }
  if (type === '5') return { type: 'dir', path, mode, mtime }
  return null
}

/**
 * The entries of an uncompressed tar, hard links resolved to copies of what they link to. Each
 * path it leaves out for being absolute or climbing out (not the archive's own `./`) goes in
 * `unsafe`, as the tar names it.
 */
export function readTar(tar: Buffer, unsafe?: string[]): TarEntry[] {
  const out: TarEntry[] = []
  const files = new Map<string, Buffer>()
  const pending: Pending = { pax: {} }
  let at = 0
  while (at + BLOCK <= tar.length) {
    const h = tar.subarray(at, at + BLOCK)
    const size = sizeOf(h, pending)
    if (size === null) break
    const data = tar.subarray(at + BLOCK, at + BLOCK + size)
    at += BLOCK + Math.ceil(size / BLOCK) * BLOCK
    const e = entryOf(h, data, pending, unsafe)
    if (!e) continue
    if ('link' in e) {
      const linked = files.get(e.link)
      if (linked)
        out.push({ type: 'file', path: e.path, mode: e.mode, mtime: e.mtime, data: linked })
      continue
    }
    if (e.type === 'file') files.set(e.path, e.data)
    out.push(e)
  }
  return out
}

/**
 * The entries of an uncompressed tar as it streams in, holding one entry's data at a time, as
 * `readTar` reads them but for hard links, which it leaves out: what one links to has gone by.
 */
export async function* readTarStream(
  source: AsyncIterable<Uint8Array>,
  unsafe?: string[],
): AsyncGenerator<TarEntry> {
  const it = source[Symbol.asyncIterator]()
  const chunks: Buffer[] = []
  let have = 0
  const take = async (n: number): Promise<Buffer | null> => {
    while (have < n) {
      const next = await it.next()
      if (next.done) return null
      const chunk = Buffer.from(next.value)
      chunks.push(chunk)
      have += chunk.length
    }
    const all = chunks.length === 1 ? (chunks[0] as Buffer) : Buffer.concat(chunks, have)
    chunks.length = 0
    const rest = all.subarray(n)
    if (rest.length) chunks.push(rest)
    have = rest.length
    return all.subarray(0, n)
  }
  const pending: Pending = { pax: {} }
  try {
    for (;;) {
      const h = await take(BLOCK)
      if (!h) return
      const size = sizeOf(h, pending)
      if (size === null) return
      const body = await take(Math.ceil(size / BLOCK) * BLOCK)
      if (!body) return
      const e = entryOf(Buffer.from(h), body.subarray(0, size), pending, unsafe)
      if (e && !('link' in e)) yield e
    }
  } finally {
    await it.return?.()
  }
}

function paxEntry(fields: Record<string, string>): Buffer {
  const body = Object.entries(fields)
    .map(([k, v]) => {
      const rest = ` ${k}=${v}\n`
      const restBytes = Buffer.byteLength(rest)
      // The length counts its own digits.
      let len = restBytes + String(restBytes).length
      if (String(len).length > String(restBytes).length) len = restBytes + String(len).length
      return `${len}${rest}`
    })
    .join('')
  const data = Buffer.from(body)
  return Buffer.concat([header('PaxHeader', 0o644, data.length, 0, 'x', ''), pad(data)])
}

const pad = (data: Buffer) =>
  Buffer.concat([data, Buffer.alloc((BLOCK - (data.length % BLOCK)) % BLOCK)])

function header(
  name: string,
  mode: number,
  size: number,
  mtime: number,
  type: string,
  link: string,
): Buffer {
  const h = Buffer.alloc(BLOCK)
  const put = (value: string, at: number, len: number) => {
    Buffer.from(value).copy(h, at, 0, Math.min(len, Buffer.byteLength(value)))
  }
  const num = (value: number, at: number, len: number) =>
    put(`${value.toString(8).padStart(len - 1, '0')}\0`, at, len)
  put(name, 0, 100)
  num(mode, 100, 8)
  num(0, 108, 8)
  num(0, 116, 8)
  num(size, 124, 12)
  num(Math.max(0, mtime), 136, 12)
  h.fill(0x20, 148, 156)
  put(type, 156, 1)
  put(link, 157, 100)
  put('ustar\0', 257, 6)
  put('00', 263, 2)
  let sum = 0
  for (const byte of h) sum += byte
  put(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8)
  return h
}

const fits = (s: string) => Buffer.byteLength(s) <= 100 && /^[\x20-\x7e]*$/.test(s)

/** One entry of a tar as `writeTar` writes it: a pax header first where it needs one. */
export function tarEntry(e: TarEntry): Buffer {
  const parts: Buffer[] = []
  const name = e.type === 'dir' ? `${e.path}/` : e.path
  const link = e.type === 'symlink' ? e.target : ''
  const long: Record<string, string> = {}
  if (!fits(name)) long.path = name
  if (!fits(link)) long.linkpath = link
  if (Object.keys(long).length) parts.push(paxEntry(long))
  const shortName = fits(name) ? name : 'long-name'
  const shortLink = fits(link) ? link : 'long-link'
  if (e.type === 'file') {
    parts.push(header(shortName, e.mode, e.data.length, e.mtime, '0', ''), pad(e.data))
  } else {
    parts.push(header(shortName, e.mode, 0, e.mtime, e.type === 'dir' ? '5' : '2', shortLink))
  }
  return Buffer.concat(parts)
}

/** The two zero blocks a tar ends with, after its last `tarEntry`. */
export const TAR_END = Buffer.alloc(BLOCK * 2)

/** An uncompressed tar of `entries`, with a pax header for a path or link target ustar can't hold. */
export function writeTar(entries: TarEntry[]): Buffer {
  return Buffer.concat([...entries.map(tarEntry), TAR_END])
}

/**
 * Writes `entries` under `dir`, never through a symbolic link: an entry whose parent on disk is a
 * link or a file is skipped, as is one whose path exists already, so nothing lands outside `dir`
 * even where the filesystem folds case. An entry the platform refuses (a name Windows can't hold,
 * a link without the right to make one) is skipped too. Returns the paths it skipped.
 */
export async function extractTar(entries: TarEntry[], dir: string): Promise<string[]> {
  const root = resolve(dir)
  const skipped: string[] = []
  await mkdir(root, { recursive: true })
  const times: Array<[string, number]> = []
  const parentsAreDirs = async (parts: string[]) => {
    let at = root
    for (const part of parts.slice(0, -1)) {
      at = join(at, part)
      const info = await lstat(at).catch(() => null)
      if (!info) await mkdir(at)
      else if (!info.isDirectory()) return false
    }
    return true
  }
  for (const e of entries) {
    const parts = e.path.split('/')
    const target = join(root, ...parts)
    try {
      if (!target.startsWith(root + sep) || !(await parentsAreDirs(parts))) {
        skipped.push(e.path)
        continue
      }
      const existing = await lstat(target).catch(() => null)
      if (e.type === 'dir') {
        if (!existing) await mkdir(target)
        else if (!existing.isDirectory()) skipped.push(e.path)
        continue
      }
      if (existing) {
        skipped.push(e.path)
        continue
      }
      if (e.type === 'symlink') await symlink(e.target, target)
      else {
        await writeFile(target, e.data, { mode: e.mode & 0o777 || 0o644, flag: 'wx' })
        times.push([target, e.mtime])
      }
    } catch {
      skipped.push(e.path)
    }
  }
  for (const [path, mtime] of times) await utimes(path, mtime, mtime).catch(() => {})
  return skipped
}

/** The tree under `dir` as entries, in a stable order; a symbolic link is kept as one, never followed. */
export async function readTree(dir: string, prefix = ''): Promise<TarEntry[]> {
  const entries: TarEntry[] = []
  for (const name of (await readdir(dir)).sort()) {
    const full = join(dir, name)
    const path = prefix ? `${prefix}/${name}` : name
    const info = await lstat(full)
    const meta = { path, mode: info.mode & 0o7777, mtime: Math.floor(info.mtimeMs / 1000) }
    if (info.isSymbolicLink())
      entries.push({ type: 'symlink', ...meta, target: await readlink(full) })
    else if (info.isDirectory()) {
      entries.push({ type: 'dir', ...meta }, ...(await readTree(full, path)))
    } else if (info.isFile()) entries.push({ type: 'file', ...meta, data: await readFile(full) })
  }
  return entries
}

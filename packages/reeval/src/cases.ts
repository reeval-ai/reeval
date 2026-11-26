// `cases` on an eval: each case's key, and the name its attempts plan under. A case plans as an
// entry of its own named `<eval>#<key>`, so its attempts keep their keys, and the record folds
// the entries back into one eval with cases (`history/cases.ts`).
import { UsageError } from './errors.ts'
import { isObjectLike } from './object.ts'
import { redactSecrets } from './redact.ts'

/** The longest a case key may be. */
export const CASE_KEY_MAX = 80

/**
 * Characters a case key can't hold: attempt ids split on `#` and eval ids on `›`, and control
 * characters. A `/` is allowed: a key is its own path segment wherever it's in one.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it refuses
const BAD_KEY = /[#›\u0000-\u001f\u007f]/

/** The name a case's eval plans under: `adds-a-check#nextjs`. */
export const caseEvalName = (name: string, key: string) => `${name}#${key}`

const shown = (value: unknown) => redactSecrets(JSON.stringify(value) ?? String(value))

/**
 * Each case's `key`, in list order. Every case is an object whose `key` is 1–80 characters, with
 * no surrounding whitespace, `#`, `›` or control characters, and unique within the eval.
 */
export function caseKeys(cases: readonly unknown[], where: string): string[] {
  const seen = new Map<string, number>()
  return cases.map((item, i) => {
    if (!isObjectLike(item) || Array.isArray(item)) {
      throw new UsageError(
        `cases[${i}] in ${where} is ${shown(item)}: a case is an object with a key, e.g. { key: 'users', … }.`,
      )
    }
    const key = item.key
    if (typeof key !== 'string') {
      throw new UsageError(
        key === undefined
          ? `cases[${i}] in ${where} has no key: a case is an object with a key, e.g. { key: 'users', … }.`
          : `cases[${i}] in ${where} has the key ${shown(key)}: a case's key is a string, e.g. { key: 'users', … }.`,
      )
    }
    if (!key || key !== key.trim() || key.length > CASE_KEY_MAX || BAD_KEY.test(key)) {
      throw new UsageError(
        `cases[${i}] in ${where} has the key ${shown(key)}: a case key is 1–${CASE_KEY_MAX} characters, with no surrounding whitespace, #, › or control characters.`,
      )
    }
    const earlier = seen.get(key)
    if (earlier !== undefined) {
      throw new UsageError(
        `cases[${earlier}] and cases[${i}] in ${where} have the same key "${redactSecrets(key)}". Each case needs its own key.`,
      )
    }
    seen.set(key, i)
    return key
  })
}

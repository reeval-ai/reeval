// A held secret whose value is a reference another server, the filler, swaps for the value. A
// request carrying the reference goes to the filler instead of its own host, untouched, with the
// URL it was for and the filler's bearer token in headers of their own, so the request's own
// `Authorization` stays free for the reference.

/** Where a filled secret's requests go, and the bearer token that filler takes. */
export type Filler = { url: string; token: string }

/** The header a filled request names its absolute target URL in. */
export const FILL_TARGET_HEADER = 'reeval-fill-target'
/** The header a filled request carries the filler's bearer token in. */
export const FILL_AUTHORIZATION_HEADER = 'reeval-fill-authorization'

/**
 * Why `url` can't be a filler's, or undefined when it can: an `https://` URL with no user, query
 * or fragment.
 */
export function fillerUrlProblem(url: string): string | undefined {
  const parsed = URL.parse(url)
  if (parsed?.protocol !== 'https:') return 'is not an https:// URL'
  if (parsed.username || parsed.password || /[?#]/.test(url)) {
    return 'has a user, a query or a fragment, where a filler is an https:// origin and path only'
  }
  return undefined
}

/** The headers that send a request for `target` to `filler`. */
export const fillHeaders = (filler: Filler, target: string): Record<string, string> => ({
  [FILL_TARGET_HEADER]: target,
  [FILL_AUTHORIZATION_HEADER]: `Bearer ${filler.token}`,
})

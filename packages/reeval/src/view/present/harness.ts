// How every surface names a coding harness: its display name, with the model beside it.

/** Each harness kind's display name; the same names as the harness catalog's. */
export const HARNESS_NAMES: Readonly<Record<string, string>> = {
  antigravity: 'Antigravity',
  'claude-code': 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  fake: 'Fake',
  fx: 'fx',
  goose: 'Goose',
  'grok-build': 'Grok Build',
  opencode: 'OpenCode',
  pi: 'pi',
}

/**
 * A harness id (`claude-code:claude-sonnet-5`) as its name and model. An id reeval has no name
 * for prints as it is; `model` names the model when the id doesn't.
 */
export function harnessName(
  id: string,
  model: string | null = null,
): { name: string; model: string | null; label: string } {
  const colon = id.indexOf(':')
  const kind = colon === -1 ? id : id.slice(0, colon)
  const own = colon === -1 ? null : id.slice(colon + 1)
  const name = HARNESS_NAMES[kind] ?? (colon === -1 ? id : kind)
  const resolved = own || model
  return { name, model: resolved, label: resolved ? `${name} · ${resolved}` : name }
}

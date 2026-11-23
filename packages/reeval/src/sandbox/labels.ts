/** `[a-z0-9_-]`, starting with a letter or digit, as Compose takes a project name. */
const composeName = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^[-_]+|-+$/g, '') || 'reeval'

/**
 * Docker Compose's labels, which Docker Desktop groups containers under: the run as the project,
 * the attempt as the service. Nothing runs `docker compose` on them; `docker compose ls` lists
 * only containers with a config hash, and warns about one without config files.
 */
export function composeLabels(runId: string, attempt?: string): Record<string, string> {
  return {
    'com.docker.compose.project': composeName(runId),
    'com.docker.compose.project.config_files': '',
    'com.docker.compose.config-hash': '',
    ...(attempt !== undefined && { 'com.docker.compose.service': composeName(attempt) }),
  }
}

/** The variable naming labels for every VM `boat()` and `daytona()` create: `key=value,key=value`. */
export const SANDBOX_LABELS = 'REEVAL_SANDBOX_LABELS'

const KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,62}$/
/** Boat takes at most 20 labels a sandbox, and reeval sets 2 of its own. */
const MAX_LABELS = 18
const MAX_VALUE_BYTES = 256

/**
 * The labels {@link SANDBOX_LABELS} adds to reeval's own on every VM it creates, so something
 * outside the run can find them if the run dies. Throws, naming
 * the variable, on a pair either provider would refuse or one that would replace reeval's own.
 */
export function sandboxLabels(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const text = env[SANDBOX_LABELS]?.trim()
  if (!text) return {}
  const labels: Record<string, string> = {}
  for (const pair of text.split(',')) {
    const at = pair.indexOf('=')
    const key = (at < 0 ? pair : pair.slice(0, at)).trim()
    const value = at < 0 ? '' : pair.slice(at + 1).trim()
    const bad = (why: string) =>
      new Error(`${SANDBOX_LABELS} has ${JSON.stringify(pair.trim())}: ${why}`)
    if (at < 0) throw bad('each label is key=value, and labels are separated by commas')
    if (!KEY.test(key)) {
      throw bad(
        'a key is 1 to 63 letters, digits, ".", "_", "/" or "-", starting with a letter or digit',
      )
    }
    if (key.startsWith('reeval-')) throw bad("keys starting reeval- are reeval's own")
    if (key in labels) throw bad(`${key} is set twice`)
    if (Buffer.byteLength(value) > MAX_VALUE_BYTES) {
      throw bad(`a value is at most ${MAX_VALUE_BYTES} bytes`)
    }
    labels[key] = value
  }
  if (Object.keys(labels).length > MAX_LABELS) {
    throw new Error(`${SANDBOX_LABELS} sets more than ${MAX_LABELS} labels`)
  }
  return labels
}

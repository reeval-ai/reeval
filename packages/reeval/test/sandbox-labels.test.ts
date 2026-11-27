import assert from 'node:assert/strict'
import { test } from 'node:test'
import { composeLabels } from '../src/sandbox/labels.ts'

const NAME = /^[a-z0-9][a-z0-9_-]*$/

test('compose labels name the run as the project and the trial as the service', () => {
  const labels = composeLabels(
    '20260924T152700Z_009763c_elliot-hesp_k3f9',
    'skills/Greet_Ada # claude-code/sonnet#2',
  )
  assert.deepEqual(labels, {
    'com.docker.compose.project': '20260924t152700z_009763c_elliot-hesp_k3f9',
    'com.docker.compose.project.config_files': '',
    'com.docker.compose.config-hash': '',
    'com.docker.compose.service': 'skills-greet_ada-claude-code-sonnet-2',
  })
})

test('compose labels stay valid names for any input', () => {
  assert.equal(
    composeLabels('r', 'cases [A] # fake · docker#1')['com.docker.compose.service'],
    'cases-a-fake-docker-1',
  )
  for (const text of ['__Ünïcode run__', '---', '', '_x_']) {
    const labels = composeLabels(text, text)
    assert.match(labels['com.docker.compose.project'] ?? '', NAME, text)
    assert.match(labels['com.docker.compose.service'] ?? '', NAME, text)
  }
  assert.equal(composeLabels('r')['com.docker.compose.service'], undefined)
})

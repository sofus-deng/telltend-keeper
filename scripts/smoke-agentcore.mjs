import { spawn } from 'node:child_process'

const port = 18080
const child = spawn(process.execPath, ['dist-agentcore/app.js'], {
  env: {
    ...process.env,
    PORT: String(port),
    KEEPER_SOURCE_VERSION: 'ci-smoke',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
let stderr = ''
child.stdout.on('data', (chunk) => {
  stdout += chunk.toString()
})
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString()
})

try {
  const deadline = Date.now() + 10_000
  let response

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`AgentCore bundle exited before health check.\nstdout:\n${stdout}\nstderr:\n${stderr}`)
    }

    try {
      response = await fetch(`http://127.0.0.1:${port}/ping`)
      if (response.ok) {
        break
      }
    } catch {
      // The bundle may still be starting; bounded retry until deadline.
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  if (!response?.ok) {
    throw new Error(`AgentCore bundle did not become healthy.\nstdout:\n${stdout}\nstderr:\n${stderr}`)
  }

  const payload = await response.json()
  if (payload.status !== 'Healthy' || payload.sourceVersion !== 'ci-smoke') {
    throw new Error(`Unexpected /ping payload: ${JSON.stringify(payload)}`)
  }

  console.log(`AgentCore bundle smoke passed: ${JSON.stringify(payload)}`)
} finally {
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ])
  if (child.exitCode === null) {
    child.kill('SIGKILL')
  }
}

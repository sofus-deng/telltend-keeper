import type { AddressInfo } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'

import { createAgentCoreApp } from '../src/agentcore-app.js'

const closeCallbacks: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const close of closeCallbacks.splice(0)) {
    await close()
  }
})

async function startTestApp() {
  const prompts: string[] = []
  const app = createAgentCoreApp({
    sourceVersion: 'test-source',
    invoke: async (prompt) => {
      prompts.push(prompt)
      return { lastMessage: `handled:${prompt}` }
    },
  })

  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve())
    server.once('error', reject)
  })

  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`
  closeCallbacks.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  )

  return { baseUrl, prompts }
}

describe('AgentCore HTTP contract', () => {
  it('exposes a healthy /ping endpoint with source version evidence', async () => {
    const { baseUrl } = await startTestApp()
    const response = await fetch(`${baseUrl}/ping`)

    expect(response.status).toBe(200)
    expect(await response.json()).toStrictEqual({
      status: 'Healthy',
      sourceVersion: 'test-source',
    })
  })

  it('accepts the JSON invocation shape used by AgentCore direct code examples', async () => {
    const { baseUrl, prompts } = await startTestApp()
    const response = await fetch(`${baseUrl}/invocations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Routine maintenance request' }),
    })

    expect(response.status).toBe(200)
    expect(prompts).toStrictEqual(['Routine maintenance request'])
    expect(await response.json()).toStrictEqual({ result: 'handled:Routine maintenance request' })
  })

  it('accepts an application/octet-stream payload containing JSON', async () => {
    const { baseUrl, prompts } = await startTestApp()
    const response = await fetch(`${baseUrl}/invocations`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: Buffer.from(JSON.stringify({ prompt: 'Binary AgentCore payload' })),
    })

    expect(response.status).toBe(200)
    expect(prompts).toStrictEqual(['Binary AgentCore payload'])
  })

  it('rejects an invocation without a non-empty prompt', async () => {
    const { baseUrl, prompts } = await startTestApp()
    const response = await fetch(`${baseUrl}/invocations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: '   ' }),
    })

    expect(response.status).toBe(400)
    expect(prompts).toStrictEqual([])
    expect(await response.json()).toStrictEqual({ error: 'A non-empty prompt is required.' })
  })
})

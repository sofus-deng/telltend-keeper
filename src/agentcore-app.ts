import express, { type Express, type Request, type Response } from 'express'

export interface AgentInvocationResult {
  readonly lastMessage: unknown
}

export type AgentInvoker = (prompt: string) => Promise<AgentInvocationResult>

export interface AgentCoreAppOptions {
  readonly invoke: AgentInvoker
  readonly sourceVersion?: string
}

export function createAgentCoreApp(options: AgentCoreAppOptions): Express {
  const app = express()

  app.use(express.json({ limit: '1mb' }))
  app.use(express.raw({ type: 'application/octet-stream', limit: '1mb' }))

  app.get('/ping', (_request: Request, response: Response) => {
    response.json({
      status: 'Healthy',
      sourceVersion: options.sourceVersion ?? process.env.KEEPER_SOURCE_VERSION ?? 'development',
    })
  })

  app.post('/invocations', async (request: Request, response: Response) => {
    const prompt = extractPrompt(request.body)
    if (!prompt) {
      response.status(400).json({ error: 'A non-empty prompt is required.' })
      return
    }

    try {
      const result = await options.invoke(prompt)
      response.json({ result: result.lastMessage })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('AgentCore invocation failed:', error)
      response.status(500).json({ error: message })
    }
  })

  return app
}

function extractPrompt(body: unknown): string | undefined {
  if (Buffer.isBuffer(body)) {
    const text = body.toString('utf8').trim()
    if (text === '') {
      return undefined
    }

    try {
      return extractPrompt(JSON.parse(text) as unknown) ?? text
    } catch {
      return text
    }
  }

  if (typeof body === 'string') {
    const prompt = body.trim()
    return prompt === '' ? undefined : prompt
  }

  if (typeof body === 'object' && body !== null && 'prompt' in body) {
    const prompt = (body as { readonly prompt?: unknown }).prompt
    if (typeof prompt === 'string' && prompt.trim() !== '') {
      return prompt.trim()
    }
  }

  return undefined
}

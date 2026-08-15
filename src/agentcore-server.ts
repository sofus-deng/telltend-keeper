import { createKeeperAgent, type KeeperAgentOptions } from './agent-factory.js'
import { createAgentCoreApp } from './agentcore-app.js'

const PORT = Number.parseInt(process.env.PORT ?? '8080', 10)
const HOST = '0.0.0.0'

const configuredRegion = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
const agentOptions: KeeperAgentOptions = {
  ...(process.env.KEEPER_STATE_PATH ? { statePath: process.env.KEEPER_STATE_PATH } : {}),
  ...(process.env.KEEPER_BEDROCK_MODEL_ID
    ? { modelId: process.env.KEEPER_BEDROCK_MODEL_ID }
    : {}),
  ...(configuredRegion ? { region: configuredRegion } : {}),
}

const agent = createKeeperAgent(agentOptions)

const app = createAgentCoreApp({
  invoke: async (prompt) => agent.invoke(prompt),
})

app.listen(PORT, HOST, () => {
  console.log(`Telltend Keeper AgentCore adapter listening on ${HOST}:${PORT}`)
})

import { createKeeperAgent } from './agent-factory.js'
import { createAgentCoreApp } from './agentcore-app.js'

const PORT = Number.parseInt(process.env.PORT ?? '8080', 10)
const HOST = '0.0.0.0'

const agent = createKeeperAgent({
  statePath: process.env.KEEPER_STATE_PATH,
  modelId: process.env.KEEPER_BEDROCK_MODEL_ID,
  region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION,
})

const app = createAgentCoreApp({
  invoke: async (prompt) => agent.invoke(prompt),
})

app.listen(PORT, HOST, () => {
  console.log(`Telltend Keeper AgentCore adapter listening on ${HOST}:${PORT}`)
})

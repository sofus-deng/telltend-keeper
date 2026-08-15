import { fileURLToPath } from 'node:url'

import { createKeeperAgent } from './agent-factory.js'

async function main(): Promise<void> {
  const message =
    process.argv.slice(2).join(' ') ||
    'Update the approved homepage hero to “Summer at Northstar Cafe” and business hours to “Mon–Sun 08:00–20:00”.'

  const agent = createKeeperAgent()
  const result = await agent.invoke(message)
  console.log(result.lastMessage)
}

const invokedPath = process.argv[1]
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  await main()
}

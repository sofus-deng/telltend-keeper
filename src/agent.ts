import { fileURLToPath } from 'node:url'

import { Agent, tool } from '@strands-agents/sdk'
import { z } from 'zod'

import { capabilityNames, demoManifest, type ChangeOperation } from './domain.js'
import { evaluateOperations } from './policy.js'

const inspectSite = tool({
  name: 'site_inspect',
  description: 'Inspect the current demo site capability manifest before proposing website changes.',
  inputSchema: z.object({}),
  callback: () => JSON.stringify(demoManifest),
})

const proposeChange = tool({
  name: 'change_propose',
  description:
    'Evaluate a proposed set of website operations against the server-side capability policy. This tool does not publish.',
  inputSchema: z.object({
    operations: z
      .array(
        z.object({
          capability: z.enum(capabilityNames),
          summary: z.string().min(1),
        }),
      )
      .min(1),
  }),
  callback: ({ operations }) => {
    const result = evaluateOperations(demoManifest, operations satisfies readonly ChangeOperation[])
    return JSON.stringify(result)
  },
})

export function createKeeperAgent(): Agent {
  return new Agent({
    printer: false,
    systemPrompt: `You are Telltend Keeper, a governed website-operations agent.

Your job in this P0 build is limited to inspecting delegated site capabilities and proposing structured changes.
Always inspect the site manifest before proposing a change.
Use change_propose to evaluate requested operations.
Never claim that a website change was published, verified, or rolled back: those side-effect tools do not exist in this build.
If policy returns human_required, clearly explain that a real human decision is needed.
If policy returns deny, do not attempt to work around the restriction or invent another tool.`,
    tools: [inspectSite, proposeChange],
  })
}

async function main(): Promise<void> {
  const message =
    process.argv.slice(2).join(' ') ||
    'Update the approved homepage hero and business hours for the summer campaign.'

  const agent = createKeeperAgent()
  const result = await agent.invoke(message)
  console.log(result.lastMessage)
}

const invokedPath = process.argv[1]
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  await main()
}

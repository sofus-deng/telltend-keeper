import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Agent, tool } from '@strands-agents/sdk'
import { z } from 'zod'

import { capabilityNames, demoManifest, type ChangeOperation } from './domain.js'
import { KeeperCore } from './keeper-core.js'
import { JsonFileKeeperStore } from './store.js'

export interface KeeperAgentOptions {
  readonly statePath?: string
}

export function createKeeperAgent(options: KeeperAgentOptions = {}): Agent {
  const statePath = options.statePath ?? join(process.cwd(), '.keeper', 'runtime.json')
  const core = new KeeperCore(new JsonFileKeeperStore(statePath))
  core.ensureFixtureSite()

  const inspectSite = tool({
    name: 'site_inspect',
    description:
      'Inspect the current demo site and its delegated capability manifest before proposing website changes.',
    inputSchema: z.object({}),
    callback: () =>
      JSON.stringify({
        manifest: demoManifest,
        site: core.store.getSite(demoManifest.siteId),
      }),
  })

  const proposeChange = tool({
    name: 'change_propose',
    description:
      'Create a durable ChangeSet and evaluate its requested operations against server-side capability policy. Returns authorized, decision_required, or denied.',
    inputSchema: z.object({
      changeSetId: z.string().min(1),
      idempotencyKey: z.string().min(1),
      requestSummary: z.string().min(1),
      operations: z
        .array(
          z.object({
            capability: z.enum(capabilityNames),
            summary: z.string().min(1),
            value: z.string().min(1),
          }),
        )
        .min(1),
    }),
    callback: ({ changeSetId, idempotencyKey, requestSummary, operations }) =>
      JSON.stringify(
        core.requestChange({
          changeSetId,
          idempotencyKey,
          requestSummary,
          operations: operations as readonly ChangeOperation[],
        }),
      ),
  })

  const validateChange = tool({
    name: 'change_validate',
    description:
      'Run deterministic validation on an authorized ChangeSet. Human-gated or denied ChangeSets cannot pass this gate.',
    inputSchema: z.object({ changeSetId: z.string().min(1) }),
    callback: ({ changeSetId }) => JSON.stringify(core.validate(changeSetId)),
  })

  const requestDecision = tool({
    name: 'decision_request',
    description:
      'Read why a ChangeSet requires a human decision. This tool cannot approve the request and cannot create a website side effect.',
    inputSchema: z.object({ changeSetId: z.string().min(1) }),
    callback: ({ changeSetId }) => {
      const changeSet = core.getChangeSet(changeSetId)
      return JSON.stringify({
        changeSetId,
        state: changeSet.state,
        reasons: changeSet.policy.reasons,
        humanDecisionRequired: changeSet.state === 'decision_required',
      })
    },
  })

  const executePublication = tool({
    name: 'publish_execute',
    description:
      'Publish a validated ChangeSet to the controlled fixture site. Server-side state and policy gates are authoritative; this tool is idempotent by ChangeSet key.',
    inputSchema: z.object({ changeSetId: z.string().min(1) }),
    callback: ({ changeSetId }) => JSON.stringify(core.publish(changeSetId)),
  })

  const verifyPublication = tool({
    name: 'publish_verify',
    description:
      'Read the actual fixture site state after publication and compare it with the expected state. Tool success alone never counts as verification.',
    inputSchema: z.object({ changeSetId: z.string().min(1) }),
    callback: ({ changeSetId }) => JSON.stringify(core.verify(changeSetId)),
  })

  const rollbackPublication = tool({
    name: 'publish_rollback',
    description:
      'Restore the last verified fixture content after a verification failure. The core allows rollback only from verification_failed state.',
    inputSchema: z.object({ changeSetId: z.string().min(1) }),
    callback: ({ changeSetId }) => JSON.stringify(core.rollback(changeSetId)),
  })

  return new Agent({
    printer: false,
    systemPrompt: `You are Telltend Keeper, a governed website-operations agent for a controlled hackathon fixture site.

Responsibility boundary:
- You provide judgment: understand intent, inspect delegated capabilities, select bounded tools, and react to tool results.
- Keeper Core is the authority: policy, state transitions, validation, publication permission, verification, rollback, and idempotency cannot be overridden by your prompt or reasoning.

For a routine maintenance request:
1. Inspect the site first.
2. Propose one structured ChangeSet with stable IDs and explicit values.
3. If the ChangeSet is authorized, validate it before publication.
4. Publish only after validation.
5. Always verify the live fixture state after publication.
6. If verification fails, use rollback and report the recovery honestly.

If policy returns decision_required, use decision_request and stop. Do not approve on the human's behalf and do not attempt a side effect.
If policy returns denied, stop and explain the boundary. Do not invent, bypass, or substitute a more powerful tool.
Never equate a publish tool's success response with a verified live result.`,
    tools: [
      inspectSite,
      proposeChange,
      validateChange,
      requestDecision,
      executePublication,
      verifyPublication,
      rollbackPublication,
    ],
  })
}

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

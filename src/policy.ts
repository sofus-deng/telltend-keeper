import type {
  CapabilityName,
  ChangeOperation,
  PolicyResult,
  SiteCapabilityManifest,
} from './domain.js'

export function evaluateOperations(
  manifest: SiteCapabilityManifest,
  operations: readonly ChangeOperation[],
): PolicyResult {
  if (operations.length === 0) {
    return {
      decision: 'deny',
      reasons: ['A ChangeSet must contain at least one operation.'],
      evaluatedCapabilities: [],
    }
  }

  const rules = new Map(manifest.capabilities.map((rule) => [rule.name, rule]))
  const evaluatedCapabilities: CapabilityName[] = []
  const reasons: string[] = []
  let requiresHuman = false

  for (const operation of operations) {
    const rule = rules.get(operation.capability)
    evaluatedCapabilities.push(operation.capability)

    if (!rule) {
      return {
        decision: 'deny',
        reasons: [`Capability ${operation.capability} is not present in the site manifest.`],
        evaluatedCapabilities,
      }
    }

    if (rule.approval === 'denied') {
      return {
        decision: 'deny',
        reasons: [`Capability ${operation.capability} is not delegated to Keeper.`],
        evaluatedCapabilities,
      }
    }

    if (rule.approval === 'human') {
      requiresHuman = true
      reasons.push(`Capability ${operation.capability} requires a human decision.`)
    }
  }

  if (requiresHuman) {
    return {
      decision: 'human_required',
      reasons,
      evaluatedCapabilities,
    }
  }

  return {
    decision: 'allow',
    reasons: ['All requested capabilities are delegated for autonomous execution.'],
    evaluatedCapabilities,
  }
}

export const capabilityNames = [
  'content.hero',
  'content.hours',
  'content.cta',
  'pricing.change',
  'tracking.script',
] as const

export type CapabilityName = (typeof capabilityNames)[number]

export type ApprovalMode = 'auto' | 'human' | 'denied'

export interface CapabilityRule {
  readonly name: CapabilityName
  readonly approval: ApprovalMode
  readonly description: string
}

export interface SiteCapabilityManifest {
  readonly siteId: string
  readonly version: string
  readonly capabilities: readonly CapabilityRule[]
}

export interface ChangeOperation {
  readonly capability: CapabilityName
  readonly summary: string
}

export type PolicyDecision = 'allow' | 'human_required' | 'deny'

export interface PolicyResult {
  readonly decision: PolicyDecision
  readonly reasons: readonly string[]
  readonly evaluatedCapabilities: readonly CapabilityName[]
}

export const demoManifest: SiteCapabilityManifest = {
  siteId: 'keeper-demo-site',
  version: '2026-08-15.1',
  capabilities: [
    {
      name: 'content.hero',
      approval: 'auto',
      description: 'Update an already-approved home-page campaign hero.',
    },
    {
      name: 'content.hours',
      approval: 'auto',
      description: 'Update published business hours from an approved source.',
    },
    {
      name: 'content.cta',
      approval: 'auto',
      description: 'Update an existing call-to-action using approved content.',
    },
    {
      name: 'pricing.change',
      approval: 'human',
      description: 'Change customer-visible pricing or discount claims.',
    },
    {
      name: 'tracking.script',
      approval: 'denied',
      description: 'Add or modify executable tracking scripts.',
    },
  ],
}

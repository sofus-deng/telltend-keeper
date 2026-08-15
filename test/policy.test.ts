import { describe, expect, it } from 'vitest'

import { demoManifest, type ChangeOperation } from '../src/domain.js'
import { evaluateOperations } from '../src/policy.js'

describe('evaluateOperations', () => {
  it('allows only delegated low-risk operations', () => {
    const operations: ChangeOperation[] = [
      { capability: 'content.hero', summary: 'Replace the approved campaign hero.' },
      { capability: 'content.hours', summary: 'Publish approved summer hours.' },
    ]

    expect(evaluateOperations(demoManifest, operations)).toStrictEqual({
      decision: 'allow',
      reasons: ['All requested capabilities are delegated for autonomous execution.'],
      evaluatedCapabilities: ['content.hero', 'content.hours'],
    })
  })

  it('requires a human decision for sensitive pricing changes', () => {
    const operations: ChangeOperation[] = [
      { capability: 'content.cta', summary: 'Update the approved CTA.' },
      { capability: 'pricing.change', summary: 'Change the public campaign price.' },
    ]

    expect(evaluateOperations(demoManifest, operations)).toStrictEqual({
      decision: 'human_required',
      reasons: ['Capability pricing.change requires a human decision.'],
      evaluatedCapabilities: ['content.cta', 'pricing.change'],
    })
  })

  it('fails closed for capabilities that are never delegated', () => {
    const operations: ChangeOperation[] = [
      { capability: 'tracking.script', summary: 'Insert a new analytics script.' },
    ]

    expect(evaluateOperations(demoManifest, operations)).toStrictEqual({
      decision: 'deny',
      reasons: ['Capability tracking.script is not delegated to Keeper.'],
      evaluatedCapabilities: ['tracking.script'],
    })
  })

  it('rejects an empty ChangeSet', () => {
    expect(evaluateOperations(demoManifest, [])).toStrictEqual({
      decision: 'deny',
      reasons: ['A ChangeSet must contain at least one operation.'],
      evaluatedCapabilities: [],
    })
  })
})

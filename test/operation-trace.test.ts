import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { defaultFixtureSite, KeeperCore } from '../src/keeper-core.js'
import { projectKeeperChangeSetTrace } from '../src/operation-trace.js'
import { JsonFileKeeperStore } from '../src/store.js'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function harness() {
  const directory = mkdtempSync(join(tmpdir(), 'telltend-keeper-trace-'))
  temporaryDirectories.push(directory)
  const statePath = join(directory, 'keeper-state.json')
  let tick = 0
  const clock = () => `2026-08-22T06:30:${String(tick++).padStart(2, '0')}.000Z`
  const store = new JsonFileKeeperStore(statePath)
  const core = new KeeperCore(store, undefined, clock)
  core.ensureFixtureSite()
  return { core, store }
}

function serializedTraceDoesNotContain(trace: unknown, forbidden: readonly string[]): void {
  const serialized = JSON.stringify(trace)
  for (const value of forbidden) {
    expect(serialized).not.toContain(value)
  }
}

describe('OperationTrace read-only projection', () => {
  it('projects an actually verified ChangeSet without copying site or request payload', () => {
    const { core, store } = harness()
    const requested = core.requestChange({
      changeSetId: 'trace-routine',
      idempotencyKey: 'trace-routine-v1',
      requestSummary: 'Publish the approved summer campaign content.',
      operations: [
        {
          capability: 'content.hero',
          summary: 'Update the approved campaign hero.',
          value: 'Summer at Northstar Cafe',
        },
        {
          capability: 'content.hours',
          summary: 'Publish the approved summer hours.',
          value: 'Mon–Sun 08:00–20:00',
        },
      ],
    })

    core.validate(requested.id)
    core.publish(requested.id)
    expect(core.verify(requested.id).verified).toBe(true)

    const trace = projectKeeperChangeSetTrace(store.snapshot(), requested.id)

    expect(trace).toMatchObject({
      spec_version: '0.1',
      trace_id: 'telltend:changeset:trace-routine',
      owner_entity: 'ls.engine.telltend',
      operation_type: 'site_changeset',
      source_state_refs: ['telltend:site-state:keeper-demo-site@v1'],
      principal_refs: [],
      approval_refs: [],
      rollback_ref: null,
      owner_status: 'verified',
    })
    expect(trace.subject_refs).toContain('telltend:capability:content.hero')
    expect(trace.subject_refs).toContain('telltend:capability:content.hours')
    expect(trace.outcome_refs).toContain('telltend:site-state:keeper-demo-site@v2')
    expect(trace.evidence_refs).toContain('telltend:verification:trace-routine:verified')

    serializedTraceDoesNotContain(trace, [
      'Summer at Northstar Cafe',
      'Mon–Sun 08:00–20:00',
      'Publish the approved summer campaign content.',
      defaultFixtureSite.hero,
      defaultFixtureSite.hours,
      defaultFixtureSite.cta,
      defaultFixtureSite.price,
    ])
  })

  it('preserves a real human-decision reference without exporting identity or decision reason', () => {
    const { core, store } = harness()
    const requested = core.requestChange({
      changeSetId: 'trace-human',
      idempotencyKey: 'trace-human-v1',
      requestSummary: 'Change the public campaign price.',
      operations: [
        {
          capability: 'pricing.change',
          summary: 'Change the public campaign price.',
          value: '$9',
        },
      ],
    })

    expect(requested.state).toBe('decision_required')
    core.resolveDecision({
      changeSetId: requested.id,
      approved: true,
      decidedBy: 'site-owner',
      reason: 'Approved promotional price for the campaign window.',
    })
    core.validate(requested.id)
    core.publish(requested.id)
    core.verify(requested.id)

    const trace = projectKeeperChangeSetTrace(store.snapshot(), requested.id)

    expect(trace.owner_status).toBe('verified')
    expect(trace.principal_refs).toStrictEqual(['telltend:human-decision:trace-human'])
    expect(trace.approval_refs).toStrictEqual(['telltend:human-decision:trace-human'])
    serializedTraceDoesNotContain(trace, [
      'site-owner',
      'Approved promotional price for the campaign window.',
      'Change the public campaign price.',
      '$9',
    ])
  })

  it('projects verification failure and actual rollback as evidence and recovery references', () => {
    const { core, store } = harness()
    const requested = core.requestChange({
      changeSetId: 'trace-rollback',
      idempotencyKey: 'trace-rollback-v1',
      requestSummary: 'Update the approved homepage CTA.',
      operations: [
        {
          capability: 'content.cta',
          summary: 'Update the approved CTA.',
          value: 'Reserve a summer table',
        },
      ],
    })

    core.validate(requested.id)
    core.publish(requested.id, { failureMode: 'false_success' })
    expect(core.verify(requested.id).verified).toBe(false)
    core.rollback(requested.id)

    const trace = projectKeeperChangeSetTrace(store.snapshot(), requested.id)

    expect(trace.owner_status).toBe('rolled_back')
    expect(trace.rollback_ref).toBe('telltend:site-state:keeper-demo-site@v1')
    expect(trace.evidence_refs).toContain('telltend:verification:trace-rollback:failed')
    expect(trace.outcome_refs).toContain('telltend:site-state:keeper-demo-site@v2')
    serializedTraceDoesNotContain(trace, [
      'Reserve a summer table',
      'Update the approved homepage CTA.',
      defaultFixtureSite.cta,
    ])
  })

  it('refuses to invent a source-state trace before publication exists', () => {
    const { core, store } = harness()
    const requested = core.requestChange({
      changeSetId: 'trace-not-published',
      idempotencyKey: 'trace-not-published-v1',
      requestSummary: 'Update approved business hours.',
      operations: [
        {
          capability: 'content.hours',
          summary: 'Update approved business hours.',
          value: 'Daily 08:00–20:00',
        },
      ],
    })

    core.validate(requested.id)

    expect(() => projectKeeperChangeSetTrace(store.snapshot(), requested.id)).toThrowError(
      /has no publication record/,
    )
  })
})

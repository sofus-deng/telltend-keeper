import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { defaultFixtureSite, KeeperCore } from '../src/keeper-core.js'
import { JsonFileKeeperStore } from '../src/store.js'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function harness() {
  const directory = mkdtempSync(join(tmpdir(), 'telltend-keeper-'))
  temporaryDirectories.push(directory)
  const statePath = join(directory, 'keeper-state.json')
  let tick = 0
  const clock = () => `2026-08-15T16:00:${String(tick++).padStart(2, '0')}.000Z`
  const store = new JsonFileKeeperStore(statePath)
  const core = new KeeperCore(store, undefined, clock)
  core.ensureFixtureSite()
  return { core, store, statePath, clock }
}

describe('KeeperCore runtime gate', () => {
  it('completes an authorized fixture publication only after live-state verification', () => {
    const { core, store } = harness()

    const requested = core.requestChange({
      changeSetId: 'change-routine',
      idempotencyKey: 'request-routine-v1',
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

    expect(requested.state).toBe('authorized')
    expect(core.validate(requested.id).state).toBe('validated')

    const publishResult = core.publish(requested.id)
    expect(publishResult.replayed).toBe(false)
    expect(core.getChangeSet(requested.id).state).toBe('published')

    const verification = core.verify(requested.id)
    expect(verification.verified).toBe(true)
    expect(core.getChangeSet(requested.id).state).toBe('verified')
    expect(store.getSite(defaultFixtureSite.siteId)).toMatchObject({
      version: 2,
      hero: 'Summer at Northstar Cafe',
      hours: 'Mon–Sun 08:00–20:00',
    })
  })

  it('requires a real human decision before a sensitive price change can create a side effect', () => {
    const { core, store } = harness()
    const before = store.getSite(defaultFixtureSite.siteId)

    const requested = core.requestChange({
      changeSetId: 'change-price',
      idempotencyKey: 'request-price-v1',
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
    expect(() => core.validate(requested.id)).toThrowError(/must be authorized/)
    expect(store.getSite(defaultFixtureSite.siteId)).toStrictEqual(before)
    expect(store.snapshot().publications).toStrictEqual({})

    expect(
      core.resolveDecision({
        changeSetId: requested.id,
        approved: true,
        decidedBy: 'site-owner',
        reason: 'Approved promotional price for the campaign window.',
      }).state,
    ).toBe('authorized')

    core.validate(requested.id)
    core.publish(requested.id)
    expect(core.verify(requested.id).verified).toBe(true)
    expect(store.getSite(defaultFixtureSite.siteId)?.price).toBe('$9')
  })

  it('fails closed for a capability Keeper is never delegated to execute', () => {
    const { core, store } = harness()
    const before = store.getSite(defaultFixtureSite.siteId)

    const requested = core.requestChange({
      changeSetId: 'change-script',
      idempotencyKey: 'request-script-v1',
      requestSummary: 'Insert a new third-party tracking script.',
      operations: [
        {
          capability: 'tracking.script',
          summary: 'Insert third-party tracking JavaScript.',
          value: '<script src="https://tracker.invalid/x.js"></script>',
        },
      ],
    })

    expect(requested.state).toBe('denied')
    expect(() => core.validate(requested.id)).toThrowError(/must be authorized/)
    expect(store.getSite(defaultFixtureSite.siteId)).toStrictEqual(before)
    expect(store.snapshot().publications).toStrictEqual({})
  })

  it('does not false-pass when a publish tool reports success but live state is wrong, then verifies rollback', () => {
    const { core, store } = harness()
    const before = store.getSite(defaultFixtureSite.siteId)
    expect(before).toBeDefined()

    const requested = core.requestChange({
      changeSetId: 'change-false-success',
      idempotencyKey: 'request-false-success-v1',
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
    const publication = core.publish(requested.id, { failureMode: 'false_success' })
    expect(publication.publication.toolReportedSuccess).toBe(true)
    expect(store.getSite(defaultFixtureSite.siteId)).toStrictEqual(before)

    const verification = core.verify(requested.id)
    expect(verification.verified).toBe(false)
    expect(core.getChangeSet(requested.id).state).toBe('verification_failed')

    const rolledBackSite = core.rollback(requested.id)
    expect(core.getChangeSet(requested.id).state).toBe('rolled_back')
    expect(rolledBackSite).toMatchObject({
      hero: before?.hero,
      hours: before?.hours,
      cta: before?.cta,
      price: before?.price,
    })
    expect(rolledBackSite.version).toBe(2)
  })

  it('replays the same publication idempotently without a duplicate site version or publication', () => {
    const { core, store } = harness()

    const requested = core.requestChange({
      changeSetId: 'change-idempotent',
      idempotencyKey: 'request-idempotent-v1',
      requestSummary: 'Update the approved campaign hero.',
      operations: [
        {
          capability: 'content.hero',
          summary: 'Update the approved hero.',
          value: 'Summer at Northstar Cafe',
        },
      ],
    })

    core.validate(requested.id)
    const first = core.publish(requested.id)
    const siteAfterFirst = store.getSite(defaultFixtureSite.siteId)
    const second = core.publish(requested.id)
    const siteAfterSecond = store.getSite(defaultFixtureSite.siteId)

    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(second.publication.id).toBe(first.publication.id)
    expect(siteAfterSecond).toStrictEqual(siteAfterFirst)
    expect(Object.keys(store.snapshot().publications)).toHaveLength(1)
  })

  it('resumes a validated ChangeSet after reconstructing the runtime from the persisted state file', () => {
    const { core, statePath, clock } = harness()

    const requested = core.requestChange({
      changeSetId: 'change-resume',
      idempotencyKey: 'request-resume-v1',
      requestSummary: 'Update approved business hours.',
      operations: [
        {
          capability: 'content.hours',
          summary: 'Publish approved weekend hours.',
          value: 'Daily 08:00–20:00',
        },
      ],
    })
    core.validate(requested.id)

    const restartedCore = new KeeperCore(new JsonFileKeeperStore(statePath), undefined, clock)
    expect(restartedCore.getChangeSet(requested.id).state).toBe('validated')
    restartedCore.publish(requested.id)
    expect(restartedCore.verify(requested.id).verified).toBe(true)
    expect(restartedCore.getChangeSet(requested.id).state).toBe('verified')
  })

  it('blocks publication when validation has not occurred', () => {
    const { core } = harness()

    const requested = core.requestChange({
      changeSetId: 'change-skip-gate',
      idempotencyKey: 'request-skip-gate-v1',
      requestSummary: 'Try to skip validation.',
      operations: [
        {
          capability: 'content.hero',
          summary: 'Update hero.',
          value: 'Unauthorized shortcut',
        },
      ],
    })

    expect(requested.state).toBe('authorized')
    expect(() => core.publish(requested.id)).toThrowError(/must be validated/)
  })
})

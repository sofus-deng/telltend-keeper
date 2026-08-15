import type { ChangeOperation, SiteCapabilityManifest } from './domain.js'
import { demoManifest } from './domain.js'
import { evaluateOperations } from './policy.js'
import type {
  FixtureSiteState,
  HumanDecision,
  PublicationFailureMode,
  PublicationRecord,
  PublishResult,
  StoredChangeSet,
  VerificationResult,
} from './runtime-types.js'
import { assertTransition } from './state-machine.js'
import { JsonFileKeeperStore } from './store.js'

export const defaultFixtureSite: FixtureSiteState = {
  siteId: 'keeper-demo-site',
  version: 1,
  hero: 'Spring at Northstar Cafe',
  hours: 'Mon–Fri 08:00–18:00',
  cta: 'See the spring menu',
  price: '$12',
}

export interface RequestChangeInput {
  readonly changeSetId: string
  readonly idempotencyKey: string
  readonly requestSummary: string
  readonly operations: readonly ChangeOperation[]
}

export interface ResolveDecisionInput {
  readonly changeSetId: string
  readonly approved: boolean
  readonly decidedBy: string
  readonly reason: string
}

export interface PublishOptions {
  readonly failureMode?: PublicationFailureMode
}

type Clock = () => string

export class KeeperCore {
  constructor(
    readonly store: JsonFileKeeperStore,
    private readonly manifest: SiteCapabilityManifest = demoManifest,
    private readonly clock: Clock = () => new Date().toISOString(),
  ) {}

  ensureFixtureSite(site: FixtureSiteState = defaultFixtureSite): FixtureSiteState {
    if (site.siteId !== this.manifest.siteId) {
      throw new Error(`Fixture site ${site.siteId} does not match manifest ${this.manifest.siteId}.`)
    }
    return this.store.ensureSite(site)
  }

  requestChange(input: RequestChangeInput): StoredChangeSet {
    const existing = this.store.findChangeSetByIdempotencyKey(input.idempotencyKey)
    if (existing) {
      this.store.appendAudit(existing.id, 'request.idempotency_replay', this.clock(), {
        idempotencyKey: input.idempotencyKey,
      })
      return existing
    }

    if (input.changeSetId.trim() === '' || input.idempotencyKey.trim() === '') {
      throw new Error('changeSetId and idempotencyKey are required.')
    }

    const now = this.clock()
    const requested: StoredChangeSet = {
      id: input.changeSetId,
      siteId: this.manifest.siteId,
      idempotencyKey: input.idempotencyKey,
      requestSummary: input.requestSummary,
      operations: structuredClone(input.operations),
      policy: evaluateOperations(this.manifest, input.operations),
      state: 'requested',
      createdAt: now,
      updatedAt: now,
    }
    this.store.saveChangeSet(requested)
    this.store.appendAudit(requested.id, 'change.requested', now, {
      idempotencyKey: requested.idempotencyKey,
      policyDecision: requested.policy.decision,
    })

    const nextState =
      requested.policy.decision === 'allow'
        ? 'authorized'
        : requested.policy.decision === 'human_required'
          ? 'decision_required'
          : 'denied'

    return this.transition(requested, nextState, `policy.${requested.policy.decision}`)
  }

  resolveDecision(input: ResolveDecisionInput): StoredChangeSet {
    const changeSet = this.requireChangeSet(input.changeSetId)
    if (changeSet.state !== 'decision_required') {
      throw new Error(`ChangeSet ${changeSet.id} is not waiting for a human decision.`)
    }

    const at = this.clock()
    const humanDecision: HumanDecision = {
      approved: input.approved,
      decidedBy: input.decidedBy,
      decidedAt: at,
      reason: input.reason,
    }

    const withDecision: StoredChangeSet = {
      ...changeSet,
      humanDecision,
      updatedAt: at,
    }
    this.store.saveChangeSet(withDecision)
    this.store.appendAudit(changeSet.id, 'decision.resolved', at, {
      approved: input.approved,
      decidedBy: input.decidedBy,
      reason: input.reason,
    })

    return this.transition(withDecision, input.approved ? 'authorized' : 'denied', 'decision.applied')
  }

  validate(changeSetId: string): StoredChangeSet {
    const changeSet = this.requireChangeSet(changeSetId)
    if (changeSet.state !== 'authorized') {
      throw new Error(`ChangeSet ${changeSet.id} must be authorized before validation.`)
    }

    for (const operation of changeSet.operations) {
      if (operation.value === undefined || operation.value.trim() === '') {
        throw new Error(`Operation ${operation.capability} requires a non-empty value.`)
      }
    }

    return this.transition(changeSet, 'validated', 'change.validated')
  }

  publish(changeSetId: string, options: PublishOptions = {}): PublishResult {
    const changeSet = this.requireChangeSet(changeSetId)
    const existingPublication = this.store.getPublicationByIdempotencyKey(changeSet.idempotencyKey)
    if (existingPublication) {
      if (existingPublication.changeSetId !== changeSet.id) {
        throw new Error(`Idempotency key collision for ${changeSet.idempotencyKey}.`)
      }
      this.store.appendAudit(changeSet.id, 'publication.idempotency_replay', this.clock(), {
        publicationId: existingPublication.id,
      })
      return { publication: existingPublication, replayed: true }
    }

    if (changeSet.state !== 'validated') {
      throw new Error(`ChangeSet ${changeSet.id} must be validated before publication.`)
    }

    const publishing = this.transition(changeSet, 'publishing', 'publication.started')
    const beforeSite = this.requireSite(publishing.siteId)
    const expectedSite = applyOperations(beforeSite, publishing.operations)
    const failureMode = options.failureMode ?? 'none'
    const actualSite = failureMode === 'false_success' ? beforeSite : expectedSite
    const at = this.clock()
    const publication: PublicationRecord = {
      id: `publication:${publishing.idempotencyKey}`,
      changeSetId: publishing.id,
      idempotencyKey: publishing.idempotencyKey,
      beforeSite,
      expectedSite,
      toolReportedSuccess: true,
      failureMode,
      createdAt: at,
    }

    const published = this.transitionInMemory(publishing, 'published', at)
    this.store.commitPublication(actualSite, publication, published, at)

    return { publication, replayed: false }
  }

  verify(changeSetId: string): VerificationResult {
    const changeSet = this.requireChangeSet(changeSetId)
    if (changeSet.state !== 'published') {
      throw new Error(`ChangeSet ${changeSet.id} must be published before verification.`)
    }

    const publication = this.store.getPublicationByIdempotencyKey(changeSet.idempotencyKey)
    if (!publication) {
      throw new Error(`Publication record is missing for ChangeSet ${changeSet.id}.`)
    }

    const actualSite = this.requireSite(changeSet.siteId)
    const verified = sitesEqual(actualSite, publication.expectedSite)
    this.transition(
      changeSet,
      verified ? 'verified' : 'verification_failed',
      verified ? 'publication.verified' : 'publication.verification_failed',
    )

    return {
      verified,
      actualSite,
      expectedSite: publication.expectedSite,
    }
  }

  rollback(changeSetId: string): FixtureSiteState {
    const changeSet = this.requireChangeSet(changeSetId)
    if (changeSet.state !== 'verification_failed') {
      throw new Error(`ChangeSet ${changeSet.id} can roll back only after verification failure.`)
    }

    const publication = this.store.getPublicationByIdempotencyKey(changeSet.idempotencyKey)
    if (!publication) {
      throw new Error(`Publication record is missing for ChangeSet ${changeSet.id}.`)
    }

    const currentSite = this.requireSite(changeSet.siteId)
    const restoredSite: FixtureSiteState = {
      ...publication.beforeSite,
      version: currentSite.version + 1,
    }
    if (!siteContentEqual(restoredSite, publication.beforeSite)) {
      throw new Error(`Rollback verification failed for ChangeSet ${changeSet.id}.`)
    }

    const at = this.clock()
    const rolledBack = this.transitionInMemory(changeSet, 'rolled_back', at)
    this.store.commitRollback(restoredSite, rolledBack, at)
    return restoredSite
  }

  getChangeSet(changeSetId: string): StoredChangeSet {
    return this.requireChangeSet(changeSetId)
  }

  private transition(changeSet: StoredChangeSet, to: StoredChangeSet['state'], auditType: string): StoredChangeSet {
    const at = this.clock()
    const next = this.transitionInMemory(changeSet, to, at)
    this.store.saveChangeSet(next)
    this.store.appendAudit(changeSet.id, auditType, at, { from: changeSet.state, to })
    return next
  }

  private transitionInMemory(
    changeSet: StoredChangeSet,
    to: StoredChangeSet['state'],
    at: string,
  ): StoredChangeSet {
    assertTransition(changeSet.state, to)
    return {
      ...changeSet,
      state: to,
      updatedAt: at,
    }
  }

  private requireChangeSet(changeSetId: string): StoredChangeSet {
    const changeSet = this.store.getChangeSet(changeSetId)
    if (!changeSet) {
      throw new Error(`Unknown ChangeSet ${changeSetId}.`)
    }
    return changeSet
  }

  private requireSite(siteId: string): FixtureSiteState {
    const site = this.store.getSite(siteId)
    if (!site) {
      throw new Error(`Unknown fixture site ${siteId}.`)
    }
    return site
  }
}

function applyOperations(
  site: FixtureSiteState,
  operations: readonly ChangeOperation[],
): FixtureSiteState {
  let next: FixtureSiteState = { ...site, version: site.version + 1 }

  for (const operation of operations) {
    const value = operation.value
    if (value === undefined) {
      throw new Error(`Operation ${operation.capability} has no value.`)
    }

    switch (operation.capability) {
      case 'content.hero':
        next = { ...next, hero: value }
        break
      case 'content.hours':
        next = { ...next, hours: value }
        break
      case 'content.cta':
        next = { ...next, cta: value }
        break
      case 'pricing.change':
        next = { ...next, price: value }
        break
      case 'tracking.script':
        throw new Error('Tracking-script execution is not supported by Keeper.')
    }
  }

  return next
}

function sitesEqual(left: FixtureSiteState, right: FixtureSiteState): boolean {
  return left.siteId === right.siteId && left.version === right.version && siteContentEqual(left, right)
}

function siteContentEqual(left: FixtureSiteState, right: FixtureSiteState): boolean {
  return (
    left.hero === right.hero &&
    left.hours === right.hours &&
    left.cta === right.cta &&
    left.price === right.price
  )
}

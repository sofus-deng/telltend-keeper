import type { ChangeOperation, PolicyResult } from './domain.js'

export type ChangeSetState =
  | 'requested'
  | 'decision_required'
  | 'authorized'
  | 'validated'
  | 'publishing'
  | 'published'
  | 'verified'
  | 'verification_failed'
  | 'rolled_back'
  | 'denied'

export interface HumanDecision {
  readonly approved: boolean
  readonly decidedBy: string
  readonly decidedAt: string
  readonly reason: string
}

export interface StoredChangeSet {
  readonly id: string
  readonly siteId: string
  readonly idempotencyKey: string
  readonly requestSummary: string
  readonly operations: readonly ChangeOperation[]
  readonly policy: PolicyResult
  readonly state: ChangeSetState
  readonly createdAt: string
  readonly updatedAt: string
  readonly humanDecision?: HumanDecision
}

export interface FixtureSiteState {
  readonly siteId: string
  readonly version: number
  readonly hero: string
  readonly hours: string
  readonly cta: string
  readonly price: string
}

export type PublicationFailureMode = 'none' | 'false_success'

export interface PublicationRecord {
  readonly id: string
  readonly changeSetId: string
  readonly idempotencyKey: string
  readonly beforeSite: FixtureSiteState
  readonly expectedSite: FixtureSiteState
  readonly toolReportedSuccess: true
  readonly failureMode: PublicationFailureMode
  readonly createdAt: string
}

export interface AuditEvent {
  readonly sequence: number
  readonly changeSetId: string
  readonly type: string
  readonly at: string
  readonly details: Readonly<Record<string, unknown>>
}

export interface KeeperSnapshot {
  readonly schemaVersion: 1
  readonly sites: Readonly<Record<string, FixtureSiteState>>
  readonly changeSets: Readonly<Record<string, StoredChangeSet>>
  readonly publications: Readonly<Record<string, PublicationRecord>>
  readonly audits: readonly AuditEvent[]
}

export interface PublishResult {
  readonly publication: PublicationRecord
  readonly replayed: boolean
}

export interface VerificationResult {
  readonly verified: boolean
  readonly actualSite: FixtureSiteState
  readonly expectedSite: FixtureSiteState
}

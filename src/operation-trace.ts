import type {
  AuditEvent,
  FixtureSiteState,
  KeeperSnapshot,
  PublicationRecord,
  StoredChangeSet,
} from './runtime-types.js'

export const OPERATION_TRACE_SPEC_VERSION = '0.1' as const

export interface OperationTraceProjection {
  readonly spec_version: typeof OPERATION_TRACE_SPEC_VERSION
  readonly trace_id: string
  readonly owner_entity: 'ls.engine.telltend'
  readonly operation_type: 'site_changeset'
  readonly subject_refs: readonly string[]
  readonly correlation_refs: readonly string[]
  readonly source_state_refs: readonly string[]
  readonly action_refs: readonly string[]
  readonly transition_refs: readonly string[]
  readonly principal_refs: readonly string[]
  readonly executor_refs: readonly string[]
  readonly policy_refs: readonly string[]
  readonly approval_refs: readonly string[]
  readonly evidence_refs: readonly string[]
  readonly outcome_refs: readonly string[]
  readonly rollback_ref: string | null
  readonly parent_trace_ref: string | null
  readonly owner_status: StoredChangeSet['state']
  readonly started_at: string
  readonly completed_at: string | null
}

/**
 * Projects already-persisted Keeper runtime truth into a small reference-only trace.
 *
 * This function is deliberately read-only. It never grants authority, performs a
 * transition, publishes, verifies, rolls back, or copies site-content, request,
 * or human-decision payloads.
 */
export function projectKeeperChangeSetTrace(
  snapshot: KeeperSnapshot,
  changeSetId: string,
): OperationTraceProjection {
  const changeSet = snapshot.changeSets[changeSetId]
  if (!changeSet) {
    throw new Error(`Unknown ChangeSet ${changeSetId}.`)
  }

  const publication = findPublication(snapshot, changeSet.id)
  if (!publication) {
    throw new Error(
      `ChangeSet ${changeSet.id} has no publication record; a source-state projection is not yet available.`,
    )
  }

  const audits = snapshot.audits.filter((event) => event.changeSetId === changeSet.id)
  const currentSite = snapshot.sites[changeSet.siteId]

  const verificationFailed = audits.some(
    (event) => event.type === 'publication.verification_failed',
  )
  const humanDecisionRef = changeSet.humanDecision
    ? `telltend:human-decision:${changeSet.id}`
    : null

  return {
    spec_version: OPERATION_TRACE_SPEC_VERSION,
    trace_id: changeSetRef(changeSet),
    owner_entity: 'ls.engine.telltend',
    operation_type: 'site_changeset',
    subject_refs: unique([
      siteRef(changeSet.siteId),
      ...changeSet.operations.map((operation) => capabilityRef(operation.capability)),
    ]),
    correlation_refs: [publicationRef(publication)],
    source_state_refs: [siteStateRef(publication.beforeSite)],
    action_refs: unique(
      changeSet.operations.map((operation) => capabilityOperationRef(operation.capability)),
    ),
    transition_refs: [],
    principal_refs: humanDecisionRef ? [humanDecisionRef] : [],
    executor_refs: ['telltend:executor:keeper-core'],
    policy_refs: [`telltend:policy-decision:${changeSet.policy.decision}`],
    approval_refs: humanDecisionRef ? [humanDecisionRef] : [],
    evidence_refs: unique([
      ...audits.map(auditRef),
      publicationRef(publication),
      ...(changeSet.state === 'verified'
        ? [`telltend:verification:${changeSet.id}:verified`]
        : verificationFailed
          ? [`telltend:verification:${changeSet.id}:failed`]
          : []),
    ]),
    outcome_refs: unique([
      `telltend:changeset-state:${changeSet.id}:${changeSet.state}`,
      ...(currentSite ? [siteStateRef(currentSite)] : []),
    ]),
    rollback_ref: changeSet.state === 'rolled_back' ? siteStateRef(publication.beforeSite) : null,
    parent_trace_ref: null,
    owner_status: changeSet.state,
    started_at: changeSet.createdAt,
    completed_at: isCompletedState(changeSet.state) ? changeSet.updatedAt : null,
  }
}

function findPublication(snapshot: KeeperSnapshot, changeSetId: string): PublicationRecord | undefined {
  return Object.values(snapshot.publications).find(
    (publication) => publication.changeSetId === changeSetId,
  )
}

function siteRef(siteId: string): string {
  return `telltend:site:${siteId}`
}

function siteStateRef(site: FixtureSiteState): string {
  return `telltend:site-state:${site.siteId}@v${site.version}`
}

function changeSetRef(changeSet: StoredChangeSet): string {
  return `telltend:changeset:${changeSet.id}`
}

function capabilityRef(capability: string): string {
  return `telltend:capability:${capability}`
}

function capabilityOperationRef(capability: string): string {
  return `telltend:operation:${capability}`
}

function publicationRef(publication: PublicationRecord): string {
  return `telltend:publication:${publication.id}`
}

function auditRef(event: AuditEvent): string {
  return `telltend:audit:${event.changeSetId}:${event.sequence}`
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function isCompletedState(state: StoredChangeSet['state']): boolean {
  return state === 'verified' || state === 'verification_failed' || state === 'rolled_back'
}

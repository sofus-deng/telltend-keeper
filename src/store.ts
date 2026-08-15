import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'

import type {
  AuditEvent,
  FixtureSiteState,
  KeeperSnapshot,
  PublicationRecord,
  StoredChangeSet,
} from './runtime-types.js'

type MutableKeeperSnapshot = {
  schemaVersion: 1
  sites: Record<string, FixtureSiteState>
  changeSets: Record<string, StoredChangeSet>
  publications: Record<string, PublicationRecord>
  audits: AuditEvent[]
}

function emptySnapshot(): MutableKeeperSnapshot {
  return {
    schemaVersion: 1,
    sites: {},
    changeSets: {},
    publications: {},
    audits: [],
  }
}

export class JsonFileKeeperStore {
  constructor(private readonly filePath: string) {}

  snapshot(): KeeperSnapshot {
    return structuredClone(this.read())
  }

  ensureSite(site: FixtureSiteState): FixtureSiteState {
    const snapshot = this.read()
    const existing = snapshot.sites[site.siteId]
    if (existing) {
      return structuredClone(existing)
    }

    snapshot.sites[site.siteId] = structuredClone(site)
    this.write(snapshot)
    return structuredClone(site)
  }

  getSite(siteId: string): FixtureSiteState | undefined {
    const site = this.read().sites[siteId]
    return site ? structuredClone(site) : undefined
  }

  saveSite(site: FixtureSiteState): void {
    const snapshot = this.read()
    snapshot.sites[site.siteId] = structuredClone(site)
    this.write(snapshot)
  }

  getChangeSet(changeSetId: string): StoredChangeSet | undefined {
    const changeSet = this.read().changeSets[changeSetId]
    return changeSet ? structuredClone(changeSet) : undefined
  }

  findChangeSetByIdempotencyKey(idempotencyKey: string): StoredChangeSet | undefined {
    const changeSet = Object.values(this.read().changeSets).find(
      (candidate) => candidate.idempotencyKey === idempotencyKey,
    )
    return changeSet ? structuredClone(changeSet) : undefined
  }

  saveChangeSet(changeSet: StoredChangeSet): void {
    const snapshot = this.read()
    snapshot.changeSets[changeSet.id] = structuredClone(changeSet)
    this.write(snapshot)
  }

  getPublicationByIdempotencyKey(idempotencyKey: string): PublicationRecord | undefined {
    const publication = this.read().publications[idempotencyKey]
    return publication ? structuredClone(publication) : undefined
  }

  savePublication(publication: PublicationRecord): void {
    const snapshot = this.read()
    snapshot.publications[publication.idempotencyKey] = structuredClone(publication)
    this.write(snapshot)
  }

  commitPublication(
    actualSite: FixtureSiteState,
    publication: PublicationRecord,
    publishedChangeSet: StoredChangeSet,
    at: string,
  ): PublicationRecord {
    const snapshot = this.read()
    const existing = snapshot.publications[publication.idempotencyKey]
    if (existing) {
      return structuredClone(existing)
    }

    snapshot.sites[actualSite.siteId] = structuredClone(actualSite)
    snapshot.publications[publication.idempotencyKey] = structuredClone(publication)
    snapshot.changeSets[publishedChangeSet.id] = structuredClone(publishedChangeSet)
    snapshot.audits.push(
      this.auditEvent(snapshot, publishedChangeSet.id, 'publication.committed', at, {
        publicationId: publication.id,
        failureMode: publication.failureMode,
        toolReportedSuccess: publication.toolReportedSuccess,
      }),
    )
    this.write(snapshot)
    return structuredClone(publication)
  }

  commitRollback(site: FixtureSiteState, rolledBackChangeSet: StoredChangeSet, at: string): void {
    const snapshot = this.read()
    snapshot.sites[site.siteId] = structuredClone(site)
    snapshot.changeSets[rolledBackChangeSet.id] = structuredClone(rolledBackChangeSet)
    snapshot.audits.push(
      this.auditEvent(snapshot, rolledBackChangeSet.id, 'publication.rolled_back', at, {
        siteVersion: site.version,
      }),
    )
    this.write(snapshot)
  }

  appendAudit(
    changeSetId: string,
    type: string,
    at: string,
    details: Readonly<Record<string, unknown>> = {},
  ): AuditEvent {
    const snapshot = this.read()
    const event = this.auditEvent(snapshot, changeSetId, type, at, details)
    snapshot.audits.push(event)
    this.write(snapshot)
    return structuredClone(event)
  }

  getAudits(changeSetId: string): readonly AuditEvent[] {
    return this.read().audits
      .filter((event) => event.changeSetId === changeSetId)
      .map((event) => structuredClone(event))
  }

  private auditEvent(
    snapshot: MutableKeeperSnapshot,
    changeSetId: string,
    type: string,
    at: string,
    details: Readonly<Record<string, unknown>>,
  ): AuditEvent {
    return {
      sequence: snapshot.audits.length + 1,
      changeSetId,
      type,
      at,
      details: structuredClone(details),
    }
  }

  private read(): MutableKeeperSnapshot {
    if (!existsSync(this.filePath)) {
      return emptySnapshot()
    }

    const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as MutableKeeperSnapshot
    if (parsed.schemaVersion !== 1) {
      throw new Error(`Unsupported Keeper snapshot schema: ${String(parsed.schemaVersion)}`)
    }
    return parsed
  }

  private write(snapshot: MutableKeeperSnapshot): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
    writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
    renameSync(temporaryPath, this.filePath)
  }
}

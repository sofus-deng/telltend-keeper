import type { ChangeSetState } from './runtime-types.js'

const allowedTransitions: Readonly<Record<ChangeSetState, readonly ChangeSetState[]>> = {
  requested: ['authorized', 'decision_required', 'denied'],
  decision_required: ['authorized', 'denied'],
  authorized: ['validated', 'denied'],
  validated: ['publishing'],
  publishing: ['published'],
  published: ['verified', 'verification_failed'],
  verified: [],
  verification_failed: ['rolled_back'],
  rolled_back: [],
  denied: [],
}

export class InvalidStateTransitionError extends Error {
  constructor(from: ChangeSetState, to: ChangeSetState) {
    super(`Invalid ChangeSet transition: ${from} -> ${to}`)
    this.name = 'InvalidStateTransitionError'
  }
}

export function assertTransition(from: ChangeSetState, to: ChangeSetState): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new InvalidStateTransitionError(from, to)
  }
}

export function canTransition(from: ChangeSetState, to: ChangeSetState): boolean {
  return allowedTransitions[from].includes(to)
}

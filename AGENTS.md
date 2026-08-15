# AGENTS.md

This repository is a public hackathon validation work for **Telltend Keeper**.

## Mission

Build the smallest credible end-to-end proof that a governed website-operations agent can:

1. understand a maintenance request;
2. operate only within delegated site capabilities;
3. create and validate a structured ChangeSet;
4. execute authorized low-risk work without unnecessary human interruption;
5. pause when a real human decision is required;
6. verify the live result instead of trusting a tool-success response;
7. roll back safely when verification fails;
8. preserve an auditable execution trail.

## Architectural rule

Keep the responsibility split explicit:

- **Strands Agent:** judgment, intent interpretation, ambiguity detection, bounded tool selection.
- **Keeper Core:** authority, policy, capability scope, state transitions, side effects, verification, rollback, idempotency, audit truth.
- **AgentCore Runtime:** deployment/runtime/session/background-execution concerns.

A model response is never authoritative state. Agent prompts must not be able to bypass server-side policy or state-transition rules.

## Public-repository boundary

Do not copy private Engine Vault documents into this repository.

Public-safe material includes only what is needed to run, test, understand, and judge this competition implementation. Do not add private pricing, GTM, full capability inventories, unreleased roadmap material, or internal strategy.

## Eligibility and lineage

- Preserve `PREEXISTING_WORK.md`.
- Record any introduced pre-existing code, assets, fixtures, or third-party material in `docs/source-lineage.md`.
- Do not rewrite history to make older product ideas appear new.
- Do not claim implementation, deployment, users, or validation that is not evidenced in this repository.

## Engineering baseline

- Node.js 22
- TypeScript
- ESM
- Strands Agents SDK
- Vitest for deterministic unit tests
- Apache-2.0 license

Prefer small provider-neutral domain modules. AWS-specific code belongs behind a runtime/adapter boundary.

## Safety rules

- No arbitrary shell or unrestricted code-execution tool for the agent.
- No production credentials or secrets in Git.
- No real customer site in the initial validation slice.
- Side effects require durable intent/state before execution.
- Unknown capabilities fail closed.
- High-risk capabilities require an explicit human decision.
- Publication success does not equal verification success.

## Development workflow

Before merging a change:

1. run type checking;
2. run deterministic tests;
3. update tests for changed policy/state behavior;
4. update public documentation when externally visible behavior changes;
5. keep dependency additions minimal and record important source/license lineage.

Prefer conventional commit messages and small reviewable pull requests.

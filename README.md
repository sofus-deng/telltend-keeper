# Telltend Keeper

Telltend Keeper is a governed website-operations agent for the **Agents for Humans Hackathon — Professional Agents** track.

It is designed to handle authorized routine website maintenance in the background, verify the live result, and involve a human only when a request is ambiguous, outside delegated authority, or genuinely high risk.

## Status

**P0 bootstrap. No production capability is claimed yet.**

This repository was created during the hackathon submission period. Product concepts and specifications that informed the project predate the hackathon; the implementation submitted from this repository is developed during the eligible period and disclosed in `PREEXISTING_WORK.md`.

The current P0 build intentionally has **no publication tool**. It proves the first architectural boundary: Strands can inspect delegated capabilities and propose work, while deterministic server-side policy decides whether the work is autonomous, requires a human decision, or is denied.

## Responsibility split

- **Strands Agents SDK** — intent interpretation, judgment, and bounded tool selection.
- **Keeper core** — capability scope, policy, state transitions, validation, publication authority, verification, rollback, idempotency, and audit truth.
- **Amazon Bedrock AgentCore Runtime** — intended competition runtime, session isolation, background execution, and runtime evidence.

The model is never the authority for production state. A model response that says a task is complete does not make a publication verified.

## Target hero loop

```text
maintenance request
→ inspect allowed site capabilities
→ create a structured ChangeSet
→ validate and evaluate policy
→ publish only when authorized
→ read the live site back
→ verify the expected result
→ rollback on verification failure
→ record an audit trail
```

A separate safety path demonstrates a request that requires a real human decision rather than allowing the agent to expand its own authority.

## P0 tools

- `site_inspect` — reads the competition-safe demo site capability manifest.
- `change_propose` — evaluates structured operations against deterministic capability policy. It does not publish.

The demo manifest currently distinguishes:

- low-risk delegated content changes that may proceed automatically;
- pricing changes that require a human decision;
- executable tracking-script changes that Keeper is not delegated to perform.

## Local setup

Prerequisites:

- Node.js 22
- npm
- AWS credentials with Amazon Bedrock model access only if you invoke the Strands agent

Install dependencies:

```bash
npm install
```

Run deterministic checks without AWS credentials:

```bash
npm run check
```

Run the P0 Strands agent:

```bash
npm run agent -- "Update the approved homepage hero and summer business hours."
```

Strands uses Amazon Bedrock by default. The exact competition model will be pinned after the model/cost spike rather than becoming part of Keeper domain truth.

## Repository map

```text
src/domain.ts              public-safe domain contracts and demo manifest
src/policy.ts              deterministic authority evaluation
src/agent.ts               bounded Strands tools and P0 agent
test/policy.test.ts        deterministic policy tests
docs/architecture.md       judgment-versus-authority architecture
docs/source-lineage.md     dependency and source ledger
PREEXISTING_WORK.md        hackathon eligibility/source disclosure
AGENTS.md                   instructions and safety rules for coding agents
```

## Public-scope boundary

This repository contains only the competition-safe implementation needed to run, test, understand, and judge Telltend Keeper. Private product strategy, full capability inventories, pricing, GTM material, and unreleased roadmap details are intentionally out of scope.

## Runtime baseline

- Node.js 22
- TypeScript
- Strands Agents SDK
- Amazon Bedrock
- Amazon Bedrock AgentCore Runtime planned for the runtime gate

## License

Apache License 2.0. See `LICENSE`.

# Telltend Keeper

Telltend Keeper is a governed website-operations agent for the **Agents for Humans Hackathon — Professional Agents** track.

It is designed to handle authorized routine website maintenance in the background, verify the actual result, and involve a human only when a request is ambiguous, outside delegated authority, or genuinely high risk.

## Status

**P1 provider-neutral runtime gate. No production deployment or customer-site capability is claimed yet.**

This repository was created during the hackathon submission period. Product concepts and specifications that informed the project predate the hackathon; the implementation submitted from this repository is developed during the eligible period and disclosed in `PREEXISTING_WORK.md`.

P0 established the judgment-versus-authority boundary. P1 adds a restart-safe controlled fixture runtime with a non-skippable ChangeSet state machine, human-decision gate, idempotent publication, actual-state verification, false-success detection, and rollback.

The current side effect changes a **controlled persisted fixture state**, not a public customer website. A live hosted fixture and Amazon Bedrock AgentCore deployment are separate evidence gates.

## Responsibility split

- **Strands Agents SDK** — intent interpretation, judgment, and bounded tool selection.
- **Keeper core** — capability scope, policy, state transitions, validation, publication authority, verification, rollback, idempotency, and audit truth.
- **Amazon Bedrock AgentCore Runtime** — intended competition runtime, session isolation, background execution, and runtime evidence.

The model is never the authority for operational state. A model response or publish-tool response that says a task is complete does not make a publication verified.

## Governed hero loop

```text
maintenance request
→ inspect delegated site capabilities
→ create a durable structured ChangeSet
→ deterministic policy decision
   ├─ authorized → validate → publish
   ├─ human required → stop for an external decision
   └─ denied → stop with no side effect
→ read actual fixture state after publication
→ verify expected result
→ rollback on verification failure
→ preserve audit and idempotency evidence
```

## Strands tool surface

Keeper exposes only bounded operations to the model:

- `site_inspect` — read the current controlled site state and capability manifest.
- `change_propose` — create a persisted ChangeSet and obtain the authoritative policy result.
- `change_validate` — validate only an authorized ChangeSet.
- `decision_request` — explain why a human decision is required; it cannot approve anything.
- `publish_execute` — execute only a validated ChangeSet through the governed core.
- `publish_verify` — compare the actual fixture state with expected publication state.
- `publish_rollback` — restore the previous verified content only after verification failure.

There is deliberately **no agent tool that grants human approval**. Human authority stays outside the model/tool loop.

The demo manifest distinguishes:

- low-risk delegated content changes that may proceed automatically;
- pricing changes that require a human decision;
- executable tracking-script changes that Keeper is not delegated to perform.

## Runtime invariants covered by tests

- gates cannot be skipped from `authorized` directly to publication;
- denied capabilities fail closed with zero publication side effect;
- sensitive pricing requires an explicit external human decision before execution;
- publication is idempotent and does not create duplicate site versions;
- an idempotency key cannot be rebound to a different request;
- persisted ChangeSets can resume after process reconstruction;
- a persisted `publishing` state can retry safely;
- a simulated publish-tool success with unchanged fixture state fails verification;
- verification failure can restore the prior content and records the rollback.

## Local setup

Prerequisites:

- Node.js 22
- npm
- AWS credentials with Amazon Bedrock model access only if you invoke the Strands agent

Install dependencies:

```bash
npm install
```

Run deterministic type checking and tests without AWS credentials:

```bash
npm run check
```

Run the Strands agent:

```bash
npm run agent -- "Update the approved homepage hero to Summer at Northstar Cafe and business hours to Mon–Sun 08:00–20:00."
```

Local agent state is persisted under `.keeper/runtime.json` and is excluded from Git. Remove that directory when you intentionally want a clean local fixture.

Strands uses Amazon Bedrock by default. The exact competition model will be pinned after a model/cost spike rather than becoming part of Keeper domain truth.

## Repository map

```text
src/domain.ts              public-safe domain contracts and capability manifest
src/policy.ts              deterministic capability policy
src/runtime-types.ts       ChangeSet, site, publication and audit contracts
src/state-machine.ts       non-skippable ChangeSet transitions
src/store.ts               restart-safe JSON state adapter for the controlled fixture
src/keeper-core.ts         governed request / decision / validate / publish / verify / rollback core
src/agent.ts               bounded Strands agent tools and orchestration prompt
test/policy.test.ts        deterministic policy tests
test/runtime.test.ts       runtime, failure, recovery and idempotency tests
docs/architecture.md       judgment-versus-authority architecture
docs/source-lineage.md     dependency and source ledger
PREEXISTING_WORK.md        hackathon eligibility/source disclosure
AGENTS.md                  instructions and safety rules for coding agents
```

## What remains before submission

P1 does **not** prove cloud-durable multi-worker state, a public hosted fixture, real Bedrock tool trajectories, AgentCore Runtime deployment, CloudWatch/OTEL traces, real customer data, agency adoption, or market validation.

The next AWS-specific gate will keep the provider-neutral core intact while adding an AgentCore-compatible deployment adapter and a public controlled fixture that can be independently read back during the demo.

## Public-scope boundary

This repository contains only the competition-safe implementation needed to run, test, understand, and judge Telltend Keeper. Private product strategy, full capability inventories, pricing, GTM material, and unreleased roadmap details are intentionally out of scope.

## Runtime baseline

- Node.js 22
- TypeScript
- Strands Agents SDK
- Amazon Bedrock for real model invocation
- Amazon Bedrock AgentCore Runtime planned as the competition runtime

## License

Apache License 2.0. See `LICENSE`.

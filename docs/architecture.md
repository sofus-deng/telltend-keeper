# Architecture

## Core rule

Telltend Keeper separates **agent judgment** from **operational authority**.

```text
User or scheduled event
        ↓
Strands Agent
intent / ambiguity / bounded tool selection
        ↓
Keeper application boundary
capability scope / policy / state / validation
        ↓
side-effect adapters
publication / verification / rollback
        ↓
controlled website
```

Amazon Bedrock AgentCore Runtime is the intended competition runtime around the agent/application process. It must not become the source of truth for Keeper domain state.

## P0 scope

The P0 bootstrap intentionally exposes only two Strands tools:

- `site_inspect` — read the demo site capability manifest;
- `change_propose` — evaluate structured operations against deterministic policy.

There is **no publication tool in P0**. The agent therefore cannot truthfully claim to have changed a website.

## Authority invariant

For every requested operation:

1. the capability must exist in the site manifest;
2. a denied capability fails closed;
3. a human-gated capability cannot be autonomously executed;
4. only explicitly delegated low-risk capabilities may continue automatically.

Later publication code must add another invariant:

> A successful publication command is not a verified publication until the live site is read back and checked against expected state.

## Planned P1 runtime slice

```text
request
→ inspect manifest
→ create ChangeSet
→ evaluate capability/policy
→ validate
→ publish authorized fixture change
→ read live fixture state
→ verify
→ rollback if verification fails
→ audit
```

A separate branch must demonstrate `human_required` without producing a production side effect before the decision is resolved.

## Provider boundary

Provider-specific concerns belong outside the domain core:

- Strands tool registration and prompt behavior;
- Amazon Bedrock model configuration;
- AgentCore deployment/session/runtime wiring;
- AWS persistence or hosting adapters.

The public-safe domain contracts should remain usable without those dependencies.

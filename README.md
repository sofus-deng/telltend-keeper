# Telltend Keeper

Telltend Keeper is a governed website-operations agent for the **Agents for Humans Hackathon — Professional Agents** track.

It is designed to handle authorized routine website maintenance in the background, verify the live result, and involve a human only when a request is ambiguous, outside delegated authority, or genuinely high risk.

## Status

**P0 bootstrap. No production capability is claimed yet.**

This repository was created during the hackathon submission period. Product concepts and specifications that informed the project predate the hackathon; submitted implementation will be developed in this repository during the eligible period and disclosed clearly in `PREEXISTING_WORK.md`.

## Intended responsibility split

- **Strands Agents SDK** — intent interpretation, judgment, and bounded tool selection.
- **Keeper core** — capability scope, policy, state transitions, validation, publication authority, verification, rollback, idempotency, and audit truth.
- **Amazon Bedrock AgentCore Runtime** — competition runtime, session isolation, background execution, and runtime evidence.

The model is never the authority for production state. A model response that says a task is complete does not make a publication verified.

## P0 hero loop

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

A second branch will demonstrate a request that requires a real human decision instead of allowing the agent to expand its own authority.

## Public-scope boundary

This repository will contain only the competition-safe implementation needed to run and evaluate Telltend Keeper. Private product strategy, full capability inventories, pricing, GTM material, and unreleased roadmap details are intentionally out of scope.

## Runtime baseline

- Node.js 22
- TypeScript
- Strands Agents SDK
- Amazon Bedrock / Amazon Bedrock AgentCore Runtime

## License

Apache License 2.0. A full `LICENSE` file is added as part of the P0 bootstrap.

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
controlled website target
```

Amazon Bedrock AgentCore Runtime is the intended competition runtime around the agent/application process. It must not become the source of truth for Keeper domain state.

## Responsibility boundary

### Strands Agent owns judgment

- interpret the maintenance request;
- inspect the site before acting;
- select from the bounded tool surface;
- respond to authoritative policy and verification results;
- surface a Decision Request when the core says a human decision is required;
- trigger rollback after verification failure.

### Keeper Core owns authority

- capability delegation;
- policy result;
- ChangeSet state and legal transitions;
- human-decision truth;
- validation;
- permission to publish;
- idempotency;
- actual-state verification;
- rollback eligibility;
- audit state.

The model cannot approve a human-gated change, alter a policy result, skip validation, or mark a publication verified.

## ChangeSet state machine

```text
requested
   ├─ allow ─────────────→ authorized → validated → publishing → published
   │                                                        │
   │                                                        ├→ verified
   │                                                        └→ verification_failed → rolled_back
   │
   ├─ human_required ───→ decision_required
   │                         ├→ authorized
   │                         └→ denied
   │
   └─ deny ──────────────→ denied
```

State transitions are enforced outside the model. Terminal states cannot be escaped by a prompt.

## P0 evidence

P0 proved the first boundary:

- public-safe `SiteCapabilityManifest`;
- deterministic `allow` / `human_required` / `deny` policy;
- bounded Strands `site_inspect` and `change_propose` tools;
- no publication authority exposed to the model;
- Node 22 TypeScript build and deterministic tests.

## P1 provider-neutral runtime gate

P1 adds a controlled persisted fixture runtime:

```text
request
→ persist requested ChangeSet
→ evaluate capability / policy
→ human gate or authorization
→ validate
→ persist publishing intent
→ idempotent fixture publication
→ read actual persisted fixture state
→ compare with expected state
→ verified
   OR
   verification_failed → rollback prior content
→ audit
```

The JSON file adapter is deliberately a **local competition fixture adapter**, not a claim of cloud-durable multi-worker storage. It uses atomic file replacement so site state, publication record, and published ChangeSet state can commit together inside this controlled adapter.

Restart/retry behavior is part of P1:

- a validated ChangeSet can resume after process reconstruction;
- a persisted `publishing` state can retry;
- a committed publication is replayed by idempotency key instead of creating a second site version;
- an idempotency key cannot be rebound to a different request.

## Failure model

P1 includes an internal-only `false_success` injection that simulates this condition:

```text
publication adapter reports success
BUT
actual fixture state did not change
```

Verification must therefore fail even though the publication record says the tool reported success. Only actual-state comparison can produce `verified`.

The failure injection is not exposed as an agent tool; it exists for deterministic regression testing.

## Human decision model

A `pricing.change` capability is intentionally classified as `human_required` in the fixture manifest.

The Strands agent can call `decision_request` to explain the reason, but there is **no tool that lets the agent approve the request**. Approval enters Keeper Core through an external human-controlled surface. Before that decision, validation and publication are blocked and the fixture site remains unchanged.

## Provider boundary

Provider-specific concerns stay outside the domain core:

- Strands tool registration and system prompt;
- Amazon Bedrock model configuration;
- AgentCore deployment, session and runtime wiring;
- CloudWatch / OpenTelemetry instrumentation;
- AWS persistence or public-hosting adapters.

The public-safe domain contracts and state machine remain usable without those dependencies.

## AgentCore deployment gate

The next AWS-specific layer will expose an AgentCore-compatible service and public controlled fixture without rewriting Keeper Core.

Current AWS documentation matters for the build boundary: Node.js ADOT auto-instrumentation patches CommonJS `require()` calls and does not instrument normal ESM output. Keeper therefore keeps its development/domain build as ESM and will use a separate AgentCore deployment build or Node-targeted bundle when observability is enabled, instead of changing domain architecture for a deployment detail.

The AWS deployment gate must produce evidence for:

1. real Strands model/tool trajectories on Amazon Bedrock;
2. AgentCore Runtime invocation and session isolation;
3. public controlled-site read-back rather than only local JSON state;
4. CloudWatch/OTEL traces showing tool sequence and failures;
5. the same deterministic Keeper Core tests continuing to pass.

## References

- Strands TypeScript deployment to AgentCore Runtime: https://strandsagents.com/docs/user-guide/deploy/deploy_to_bedrock_agentcore/typescript/
- AWS direct code deployment for Node.js: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-code-deploy-node.html
- AgentCore Observability: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability.html

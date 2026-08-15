# Source Lineage

This file records important external dependencies, pre-existing inputs, and public assets used by Telltend Keeper.

## Product input

| Source | Status before Keeper | Used for | Copied into repo? |
|---|---|---|---|
| Telltend product concept and internal specifications | Pre-existing product planning | Problem framing, domain vocabulary, authority-boundary design | No; only a public-safe re-expression is used |
| Prior Telltend competition-fit analysis | Pre-existing planning | Historical context when selecting this validation work | No |

See `PREEXISTING_WORK.md` for the eligibility-facing disclosure.

## Direct software dependencies

| Dependency | Pinned version | License | Purpose |
|---|---:|---|---|
| `@strands-agents/sdk` | `1.11.2` | Apache-2.0 | Required agent SDK; model-driven loop and typed tools |
| `express` | `5.2.1` | MIT | AgentCore Runtime HTTP `/ping` and `/invocations` adapter |
| `zod` | `4.4.3` | MIT | Runtime schemas for bounded tool inputs |
| `typescript` | `7.0.2` | Apache-2.0 | Build/type checking |
| `esbuild` | `0.28.1` | MIT | Node 22 CommonJS deployment bundle for AgentCore/ADOT compatibility |
| `tsx` | `4.23.1` | MIT | Local TypeScript execution |
| `vitest` | `4.1.10` | MIT | Deterministic tests |
| `@types/express` | `5.0.6` | MIT | Express TypeScript declarations |
| `@types/node` | `22.20.1` | MIT | Node.js type definitions matching the Node 22 baseline |

Transitive dependencies will be captured by the package lock once generated. Dependency versions must not be silently upgraded during submission freeze.

## Runtime documentation consulted

Implementation decisions currently follow:

- Strands Agents TypeScript documentation for Bedrock model configuration and AgentCore deployment;
- Amazon Bedrock AgentCore direct-code Node.js documentation for the required `/ping` and `/invocations` HTTP contract, Node 22 runtime, JavaScript entrypoint, CodeZip packaging, and ARM64 constraints;
- Amazon Bedrock AgentCore CLI TypeScript documentation for deployment, invocation, status, logs, and session evidence;
- Amazon Bedrock AgentCore observability documentation, including the current Node.js ADOT requirement to use CommonJS-compatible output rather than normal ESM output for automatic instrumentation.

These documents are references only; their source code or prose is not copied into Keeper.

## Model configuration

Keeper currently defaults explicitly to `global.anthropic.claude-sonnet-4-6` through Strands `BedrockModel`, with `KEEPER_BEDROCK_MODEL_ID` and `AWS_REGION`/`AWS_DEFAULT_REGION` as deployment-time overrides. The model identifier and region used for final evidence must be frozen in the submission record rather than inferred from defaults.

## Fixtures and assets

P0/P1/P2 use a synthetic controlled fixture and contain no third-party customer data, brand assets, or production website content.

Any future fixture or media asset must list:

- origin;
- owner/license;
- whether it was created during the contest period;
- file path;
- modifications, if any.

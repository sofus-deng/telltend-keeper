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
| `zod` | `4.4.3` | MIT | Runtime schemas for bounded tool inputs |
| `typescript` | `7.0.2` | Apache-2.0 | Build/type checking |
| `tsx` | `4.23.1` | MIT | Local TypeScript execution |
| `vitest` | `4.1.10` | MIT | Deterministic tests |
| `@types/node` | `22.20.1` | MIT | Node.js type definitions matching the Node 22 baseline |

Transitive dependencies will be captured by the package lock once generated. Dependency versions must not be silently upgraded during submission freeze.

## Runtime documentation consulted

Implementation decisions currently follow the public Strands TypeScript documentation and Amazon Bedrock AgentCore TypeScript/runtime documentation. These documents are references only; their source code or prose is not copied into Keeper.

## Fixtures and assets

P0 contains no third-party customer data, brand assets, or production website content.

Any future fixture or media asset must list:

- origin;
- owner/license;
- whether it was created during the contest period;
- file path;
- modifications, if any.

# AWS / AgentCore Deployment Runbook

This runbook starts only after the provider-neutral P1 runtime tests are green. It does not change Keeper domain authority rules.

## Goal

Produce reproducible evidence that the real Strands agent runs on Amazon Bedrock AgentCore Runtime and uses Amazon Bedrock to select bounded Keeper tools.

The AWS evidence gate is not complete until all of these are captured:

- AWS account and region used for the run;
- exact Bedrock model identifier;
- deployed Keeper source commit;
- AgentCore runtime/endpoint identity;
- successful `/ping` and real invocation;
- a recorded Strands tool trajectory;
- at least one routine path and one `human_required` or denied path;
- runtime logs/traces;
- known limitations and cleanup status.

## 1. Local prerequisites

Use Node.js 22 to match Keeper and the intended AgentCore `NODE_22` runtime.

Install/configure:

```bash
node --version
aws --version
aws sts get-caller-identity
npm install -g @aws/agentcore
agentcore --help
npm install -g aws-cdk
cdk --version
```

The AWS identity command must return the intended account. Do not paste credentials, access keys, session tokens, or bearer tokens into GitHub issues, commits, screenshots, or chat.

Before creating paid resources, verify the selected region supports the required AgentCore features and that the chosen Bedrock model is available to this account.

The current Keeper default is:

```text
model: global.anthropic.claude-sonnet-4-6
region fallback: us-west-2
```

Override explicitly when needed:

```bash
export AWS_REGION=us-west-2
export KEEPER_BEDROCK_MODEL_ID=global.anthropic.claude-sonnet-4-6
```

The final submission record must store the actual values rather than relying on these defaults.

## 2. Verify the repository before AWS work

```bash
git switch main
git pull --ff-only origin main
npm install
npm run check
npm run build:agentcore
```

`dist-agentcore/app.js` is a generated CommonJS Node 22 bundle. A generated `dist-agentcore/package.json` marks the bundle directory as CommonJS.

This separate bundle exists because current AWS Node.js ADOT auto-instrumentation patches `require()` calls; normal ESM output can run but will not receive that automatic instrumentation. Keeper's domain source remains ESM.

## 3. Local AgentCore HTTP-contract smoke test

The generated bundle implements the required HTTP endpoints:

```text
GET  /ping
POST /invocations
```

To exercise the real Strands/Bedrock path locally, valid AWS credentials and model access are required:

```bash
npm run build:agentcore
node dist-agentcore/app.js
```

Then, in another terminal:

```bash
curl http://127.0.0.1:8080/ping
```

Routine request:

```bash
curl -X POST http://127.0.0.1:8080/invocations \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Update the approved homepage hero to Summer at Northstar Cafe and business hours to Mon–Sun 08:00–20:00."}'
```

Human-decision request:

```bash
curl -X POST http://127.0.0.1:8080/invocations \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Change the public campaign price from $12 to $9."}'
```

Expected safety behavior: the agent may explain/request a human decision, but it must not approve the pricing change on its own.

## 4. Add this repository as a BYO AgentCore project

The current AgentCore CLI supports bring-your-own-code agents. Do this only on a clean working tree and inspect every generated file before committing it.

A safe setup pattern is:

```bash
agentcore create --name TelltendKeeper --no-agent --skip-git
```

Then add a BYO TypeScript HTTP agent pointing at the generated deployment bundle. Run `agentcore add agent --help` first because CLI flags can evolve, and use the current BYO fields for:

```text
name: TelltendKeeper
language: TypeScript
build: CodeZip
protocol: HTTP
runtime: NODE_22
code location: dist-agentcore/
entry point: app.js
model provider: Bedrock
```

Do **not** commit an `aws-targets.json` with a guessed account ID. Let the CLI write the actual account/region target, inspect it, and then decide what is safe to keep public.

Before deployment:

```bash
agentcore validate
agentcore deploy --dry-run
```

Review the CDK/CloudFormation plan and expected IAM/runtime resources before creating anything.

## 5. Deploy and invoke

After the dry run is understood:

```bash
agentcore deploy -v
agentcore status
```

Invoke with an explicit session ID so the evidence can be correlated:

```bash
agentcore invoke --session-id keeper-routine-001 \
  "Update the approved homepage hero to Summer at Northstar Cafe and business hours to Mon–Sun 08:00–20:00."
```

Then test the human-decision branch with a different session:

```bash
agentcore invoke --session-id keeper-human-001 \
  "Change the public campaign price from $12 to $9."
```

Record only non-secret evidence: runtime identity, region, model ID, source commit, session IDs, timestamps, selected tool sequence, authoritative policy result, final state, and trace/log references.

## 6. Observability evidence

Enable AgentCore observability/CloudWatch Transaction Search according to the current AWS documentation. For Node.js automatic ADOT instrumentation, deploy the CommonJS-compatible bundle rather than Keeper's normal ESM build.

Useful CLI surfaces after deployment include:

```bash
agentcore logs
agentcore traces list
agentcore status
```

Evidence should make these distinctions visible:

```text
model judgment
≠
Keeper authority decision
≠
publish-tool response
≠
verified outcome
```

## 7. Hosted fixture gate

AgentCore deployment alone does not complete the competition hero loop. P1 currently changes a local persisted fixture.

Before submission, move the controlled fixture behind a separately readable hosted surface so `publish_verify` obtains the actual state independently of the publication adapter. Keep this synthetic/owned; do not use a customer's production website for the competition proof.

The hosted target must support a deliberate false-success test without damaging unrelated resources.

## 8. Cost guardrail and cleanup

The promotional credit request is not considered approved until AWS confirms it. Use a small, time-bounded deployment and remove resources that are not needed for judging.

Before cleanup, save the final evidence snapshot required by Contest Vault. Then use the current AgentCore CLI cleanup flow and verify the resulting AWS resources are gone.

Never treat cleanup as successful solely because a CLI command returned zero; verify in `agentcore status` and the relevant AWS console/resource inventory.

## Official references

- AWS AgentCore CLI TypeScript quick start: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-cli-typescript.html
- AWS Node.js direct code deployment: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-code-deploy-node.html
- AWS InvokeAgentRuntime: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-invoke-agent.html
- Strands TypeScript AgentCore deployment: https://strandsagents.com/docs/user-guide/deploy/deploy_to_bedrock_agentcore/typescript/
- Strands Bedrock model provider: https://strandsagents.com/docs/user-guide/concepts/model-providers/amazon-bedrock/

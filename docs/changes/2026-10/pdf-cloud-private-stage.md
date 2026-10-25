# PDF Cloud private staging — Level 3

## Task level and problem

Initial/final Level 3: deployment, secrets, authentication and cloud identity. The source Worker/Gateway code passed offline tests, but the existing deployment script intentionally deploys only a health-only image. Cloud Run readiness reported private IAM, queue, bucket and tmpfs mostly PASS, yet current traffic processing gates FAIL and Gateway/operator producer identity remains blocked. The owner requested a simpler path toward real PDF processing.

## Decision / change

Add an **operator-only and default-read-only** Node 24 staging helper, instead of modifying the existing health-only deploy or silently enabling production. It can stage both Worker processing and Gateway images together with immutable digests and `--no-traffic`, after explicit approval and verification that both services already exist with private invoker IAM. It never grants IAM, creates secrets, exposes Gateway publicly, switches traffic, modifies VPS, schedules recovery or sets the PDF API flag.

Worker stage target: 1 vCPU, 2 GiB, concurrency 1, max 3, 32Mi tmpfs, fixed Worker SA and processing env. Gateway stage target: 1 vCPU, 256Mi, concurrency 10, max 1, fixed gateway SA and Secret Manager HMAC reference. Node's built-in spawn interfaces support Windows PowerShell operator machines without unchecked shell text. Output errors are sanitized; no secret is read into the script.

## Verification

CI executes targeted synthetic operator staging regressions: no-traffic args, immutable image, Windows CLI safety, missing/unsafe services and IAM, approved manifest, stage traffic unchanged, invalid digests and fail-closed paths. Live Cloud Run/IAM/API/VPS testing was **not executed** by this source change. Docker image builds and Google infrastructure are not validated by CI's mocked staging executor.

## Documentation updated

- `docs/operations/pdf-cloud-rollout.md`: prerequisites, one-shot private stage, promotion boundaries, rollback.
- `docs/operations/pdf-gateway.md`: link to staging procedure.

## Rollback and remaining risks

Rollback by reverting this PR; it adds no deployment state until an authorized operator explicitly executes `--stage`. If staged privately, preserve old traffic and image revisions; prefer stop/prohibit producer first. Live staging needs existing private Gateway, gateway SA with narrowly scoped Tasks/GCS rights, Secret Manager access, verified Worker permissions, cost review and approved bootstrap. Effective/inherited IAM, the HMAC-public gateway decision, nonce lifecycle, independently scheduled recovery, real Drive/Cloud Tasks/GCS E2E, cross-device public download and a production cost/budget cap remain blocking. Source approval is **not** production approval.

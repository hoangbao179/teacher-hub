# GitHub Environment validator schema compatibility

## Task level

Initial and final: Level 3. This adapter is an authorization prerequisite before
WIF, although no IAM, repository settings or deployment resources are changed.

## Problem and root cause

The validator required policy `type === 'branch'`. The official GitHub REST LIST
example omits that field; Octokit's generated deployment-branch-policy definition
declares `type?: "branch" | "tag"`. A valid protected environment could therefore
be rejected. This does not justify defaulting other security fields to safe values.

Sources inspected:

- [GitHub REST LIST documentation](https://docs.github.com/en/rest/deployments/branch-policies#list-deployment-branch-policies)
- [Octokit generated schema](https://github.com/octokit/openapi-types.ts/blob/main/packages/openapi-types/types.d.ts)
- [github-script v8 external scripts](https://github.com/actions/github-script/blob/v8/README.md)
- [GitHub OIDC claims and environment subjects](https://docs.github.com/en/actions/reference/security/oidc)

## Decision and changes

Accept exactly one policy named `main`, matching numeric total_count 1 and an
actual array of length 1. Missing type is supported; explicit tag, null or unknown
type fails. Require literal custom_branch_policies true, valid nonempty reviewers,
prevent_self_review true and can_admins_bypass false. API errors propagate;
malformed or incomplete protection data cannot pass.

Validate repository, full branch ref and workflow_dispatch before API calls. The
workflow job also checks the event explicitly; protection validation still occurs
before Google auth. A tag named main uses refs/tags/main and fails local guards.
An omitted policy type cannot establish branch-vs-tag configuration by itself:
operator confirmation and independent provider restrictions remain mandatory.
The deploy script already checks exact branch/event; its regression now includes
the same-name tag. No VPS workflow or application business logic changes.

Keep `.cjs` for the existing github-script require adapter. `.mjs` dynamic import
would change the loader without practical benefit. TypeScript would require a
compatible runner/build path absent from this dependency-free adapter. A short
JSDoc boundary comment is useful; a new checkJs/type dependency setup is not
justified for this patch. Runtime guards remain necessary for untrusted API data.
Revisit typed extraction if substantial logic is added. AGENTS now states the
TypeScript default for new application/worker business modules and justified JS
automation exceptions. Existing worker migration remains outside scope.

## Verification

- Node 24.18.0: environment validator 5 tests passed, including official-shaped
  responses with/without type, malformed security fields, wildcard/multiple
  policies, both endpoint failures for 403/404/500, tag/context rejection and
  workflow guard/order checks. Tests use mocks and static workflow evaluation.
- Worker syntax checks and 3 HTTP/process unit tests passed (real local listener).
- Git Bash syntax checks for deployment script and test passed; deployment
  orchestration regression passed with mocked gcloud/docker, including tag guards.
- actionlint 1.7.12 passed for pdf-worker.yml; ShellCheck/Pyflakes disabled because
  unavailable. Bash syntax and mocked orchestration were checked separately.
- Repository guard and Markdown link check passed.
- No TypeScript source/config changes, so application typecheck is not applicable.
  No full app regression: changes are isolated to deployment validation and docs.
- No live Environment API, OIDC token exchange, provider inspection, verify-wif,
  container build, resource creation or deployment performed. PR metadata reads
  are not verification of environment protection or cloud IAM.

## Documentation updated

AGENTS language convention and the worker operations runbook (response contract,
tag boundary and adapter language rationale). Current feature availability and
application architecture are unchanged.

## Rollback

Revert this patch in a new commit; no persisted data or settings require rollback.
The old validator would again reject responses omitting type, leaving WIF blocked.
Do not bypass environment protections to recover a failing run.

## Remaining risks

Local regression cannot prove live environment settings, supported plan/token
permissions, main branch protections, WIF numeric identity/ref/event/workflow
conditions or subject mapping. verify-wif remains NOT READY until an operator
checks those prerequisites. Health deployment retains all separate bootstrap,
IAM, cost and Linux container verification gates in the runbook. Required PR CI
and reviews must pass before merge; local targeted PASS is not release approval.

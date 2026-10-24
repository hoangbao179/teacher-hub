# PDF Worker WIF: single-owner verifier boundary

## Task level

Initial and final: Level 3 (WIF authorization and deployment boundary).

## Problem and root cause

The same GitHub identity both verified WIF and could deploy Cloud Run. Required
independent reviewers blocked the owner's single-administrator model. Removing
reviewers alone would expose deployment credentials to a self-approved workflow;
removing a YAML deploy step alone would leave old impersonation grants usable.

## Decision and changes

GitHub authenticates only the allowlisted verifier SA and reads Artifact Registry
metadata. No deploy input/job/build/push remains. Provider trust and removal of
GitHub-to-deployer IAM paths are independent operator gates, not claims established
by the JavaScript validator. Preserve deployer roles for future manual use.

Environment reviewers are optional for this read-only operation. Require exact
repository/ref/event/environment, explicit disabled bypass and exactly one typed
main branch policy. Unlike the previous compatibility decision, missing type now
fails closed: REST schema optionality cannot establish absence of a tag policy.
Live responses include type. Missing bypass also blocks instead of assuming a
safe default. No broader GitHub API permissions or compiler/dependencies added.

The retained deployment script is operator-only: rejects Actions markers, binds
SOURCE_SHA to a clean checkout, preserves private IAM pre/post checks and separate
runtime identity. These local markers are not an IAM boundary. No cloud IAM or
runtime settings changed, and no extra VPS resources are consumed.

## Verification

- Node 24.18.0: six validator regression tests passed (no reviewers, context/tag,
  malformed responses, 403/404/500, verifier allowlist and no workflow deploy path).
- Worker syntax and three local HTTP/process tests passed.
- Git Bash syntax and mocked deploy regression passed, including Actions refusal,
  mismatched SHA, dirty checkout/Git errors, IAM failures and private-service checks.
- actionlint passed for pdf-worker.yml and ci.yml; ShellCheck/Pyflakes unavailable
  and explicitly disabled. Bash syntax/mocks checked separately.
- Live read-only GitHub Environment GET/LIST passed the revised validator. Effective
  main rules and ruleset 25771531 inspected: active PR and four CI gates, deletion
  and force-push protection. Public response omits bypass actors, so that aspect
  remains an authenticated operator check. No Google Cloud inventory available.
- Repository consistency and Markdown link guards passed; final diff checked.
- No workflow dispatch, WIF exchange, live IAM mutation, Cloud Run deploy or container
  build. No full application regression: no app/runtime/schema changes; existing CI
  remains intact. Legacy UI flags remain disabled and unrelated suites were not run.

## Documentation updated

Operations runbook contains Console setup, exact numeric-ID provider condition,
verifier-only grants, deployer impersonation revocation and inherited/delegated
access review, manual deployment, enforcement boundaries and readiness gates.
Canonical implementation status describes verifier-only Actions and manual deploy.
Prior change reports remain historical records, not current configuration guidance.

## Rollback

Revert source only with a new reviewed commit. Do not dispatch the previous workflow
or restore deployer impersonation as a workaround; disable workflow use while
reviewing recovery. No cloud/data change needs rollback. Future manual deployment
rollback remains governed by the runbook's revision/config/IAM procedure.

## Remaining risks

Live verifier roles, provider claims/audience, pool isolation, old deployer grants,
inherited/custom permissions and delegation chains remain unverified. Metadata
read success does not prove least privilege. Single owner can change protections;
there is no independent-review guarantee. Token permissions/API availability may
still block a real Actions run. Source readiness requires PR CI on the pushed head;
verify-wif and Cloud Run deployment are NOT READY until the runbook gates pass.

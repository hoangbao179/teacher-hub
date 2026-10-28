# PDF v2 deployment with preinstalled recovery units

## Task level

Initial and final: Level 3 (deployment and privilege boundary).

## Problem and root cause

Deployment probed `sudo -n true`, then installed systemd units and reloaded the
daemon. A deploy account restricted to starting recovery and enabling its timer
cannot pass that probe, despite having the required runtime permissions.

## Decision and changes

Root provisions and reloads units separately. Deployment as deploy verifies the
loaded fragments, drop-ins and both lexical/resolved parent paths are root-owned
and not writable by deploy. It rejects missing/stale units or an effective service
user other than deploy. The checked template now declares `User=deploy` explicitly.
Only enabling the exact timer and starting the exact service use `sudo -n`;
status reads are unprivileged. No broad sudo permission or gate bypass is added.

Cloud evidence, candidate/live checks, runtime snapshots and rollback behavior
remain unchanged. Active or unknown v2 jobs still prevent unsafe downgrade.
No service/container, resource limit, dependency, schema or secret is changed.

## Verification

Lightweight shell tests exercise environment preservation and mocked deployment,
including restricted sudo, missing/stale/unprotected units, wrong service/user,
timer/recovery failures and safe rollback with active/unknown jobs. Host commands
and filesystem metadata are mocked; no VPS, cloud, database or browser is started.
Repository/docs guards and shell syntax are checked separately.

- `bash scripts/pdf-v2-deploy.test.sh`: passed.
- `bash scripts/pdf-v2-deploy-flow.test.sh`: all 18 mocked scenarios passed.
- `bash -n` for the deployment helper and both shell tests: passed.
- `node --test scripts/pdf-vps-config.test.mjs`: 2 passed.
- `node scripts/check-repo.mjs`, `node scripts/check-doc-links.mjs` and
  `git diff --check`: passed.

Shell checks use Git Bash on Windows. Application typecheck/lint, full regression,
Docker builds and live integration are not run: the diff is confined to host
deployment/provisioning and its mocked boundary; no application runtime changes.

## Documentation updated

The long-document runbook defines the provisioning/privilege boundary; private
activation instructions place root provisioning before deployment. Current-state
documentation describes preinstalled recovery rather than automatic installation.

## Rollback

Revert this commit for source rollback; the older script requires broader sudo
and must not be executed under the restricted deployment policy. Keep root-owned
units and least-privilege sudoers intact; fix forward if deployment remains blocked.
Existing production rollback still requires draining v2 jobs before downgrade;
no database down migration or job deletion is needed.

## Remaining risks

Real Linux systemd, ACLs, sudoers and live recovery are not verified locally.
Root must install/reload reviewed units; copying templates alone is insufficient.
Unusual whitespace/escaped drop-in paths fail closed and need operator review.
No production readiness or real Drive E2E acceptance is claimed.

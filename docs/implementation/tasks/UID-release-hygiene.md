# UID — Release hygiene

## Goal

Produce a repeatable, inspectable source artifact that excludes secrets, Git
metadata, generated output and private student data, and document remaining
release-operational safeguards.

## Scope

- Harden Git, Docker and source-package exclusion rules.
- Move legacy private workbooks to an ignored private-data location outside the
  normal release source set.
- Add deterministic source packaging, checksum and prohibited-content checks.
- Validate public marketing configuration and prevent placeholder production
  deployments.
- Review proxy security headers and document capacity, backup, restore and secret
  rotation guidance.
- Extend repository checks for prohibited release content.

## Exclusions

- Automatic production-secret rotation, generic Excel import, infrastructure
  capacity claims without measurements and the independent full-system review.

## Required verification

```bash
npm ci
npm run check:full
npm run package:source
npm run check:package
```

Docker build is required where Docker is available. The checkpoint is complete
only when its verification report ends in `PASS`.

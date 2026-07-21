# UID Acceptance

- [x] Git, Docker and source-package rules exclude real env files, Git metadata,
  dependencies, local builds, browser artifacts, dumps, backups, logs, screenshots
  and private workbooks while preserving approved examples and fixtures.
- [x] Legacy private workbooks are outside normal source packaging in a clearly
  ignored local location.
- [x] `package:source` produces an allowlisted source archive and SHA-256 checksum;
  `check:package` rejects every required prohibited-content class.
- [x] Repository consistency checks detect real env files, prohibited workbooks,
  encoded filenames, generated screenshots and obsolete completed-feature
  placeholders.
- [x] Local demo marketing content is explicit and production validation rejects
  placeholder contact/configuration values.
- [x] Nginx security headers and the YouTube/API-compatible CSP are verified and
  HSTS guidance is documented.
- [x] Capacity measurement, swap/log rotation, daily off-server backup retention
  and restore-verification guidance is documented without unsupported claims.
- [x] Secret rotation guidance treats credentials in previously shared archives as
  exposed without printing or automatically changing real values.
- [x] `npm ci`, `check:full`, source packaging and package checks pass; Docker build
  passes where Docker is available.

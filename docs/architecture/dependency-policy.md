# Dependency policy

## Runtime baseline

- Node.js: `24.18.0` Active LTS, exact version for local tooling, CI and Docker.
- npm: `12.0.1`.
- Do not move production to a Node Current line such as Node 26 until it becomes LTS and the project has passed verification.

## Version selection

- Direct dependencies are pinned to exact versions in `package.json` and `package-lock.json`.
- Use the newest stable major that is compatible with the complete dependency graph.
- Never use `--force` or `--legacy-peer-deps` to hide peer-dependency conflicts.
- Runtime type packages must match the runtime major. Therefore `@types/node` stays on major 24, even if a newer Node major exists.
- If the newest package is incompatible with another maintained package, select the newest supported version and record the reason here.

## Current compatibility exception

TypeScript `7.0.2` is newer, but `@typescript-eslint/* 8.64.0` supports TypeScript `>=4.8.4 <6.1.0`. The project therefore pins TypeScript `6.0.3`, the newest compatible stable release, rather than bypassing the peer constraint.

## Upgrade workflow

1. Run `npm run deps:outdated`.
2. Review release notes and peer dependencies for every major update.
3. Update exact versions and regenerate `package-lock.json` on the pinned Node/npm versions.
4. Run `npm ci` from a clean state.
5. Run `npm run verify`.
6. Smoke-test authentication, migrations, lesson completion and tuition-cycle allocation.
7. Update this document when an exception or runtime baseline changes.

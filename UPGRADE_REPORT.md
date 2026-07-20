# Node 24 and dependency upgrade report

## Runtime

- Node.js target: `24.18.0` Active LTS.
- npm target: `12.0.1`.
- Pins are present in `.nvmrc`, `.node-version`, `package.json#volta`, `package.json#engines`, CI and Dockerfiles.

## Upgraded direct dependencies

- Express 5.2.1
- React / React DOM 19.2.7
- React Router DOM 7.18.1
- MUI 9.2.0
- Vite 8.1.5
- ESLint 10.7.0
- TypeScript 6.0.3
- mysql2 3.23.1
- dotenv 17.4.2
- helmet 8.3.0
- bcryptjs 3.0.3
- tsx 4.23.1

All direct versions are exact-pinned. `package-lock.json` is included.

## Compatibility decision

TypeScript 7.0.2 was not selected because the current `@typescript-eslint/* 8.64.0` peer range is `<6.1.0`. TypeScript 6.0.3 is the newest supported stable version. No `--force` or `--legacy-peer-deps` workaround is allowed.

`@types/node` is intentionally pinned to major 24 to match the production runtime rather than using definitions for Node 26 Current.

## Source changes required by major upgrades

- Migrated MUI styling props such as `fontWeight` and `justifyContent` to `sx`.
- Migrated MUI Grid from `item/xs` to the current `size` API.
- Migrated `TextField.InputLabelProps` to `slotProps.inputLabel`.
- Migrated TypeScript Node module resolution from deprecated `Node`/Node10 semantics to `Node16` where CommonJS output is required.
- Updated CI and Docker builds to Node 24.18.0 and npm 12.0.1.

## Verification

A clean dependency installation followed by these commands passed:

```bash
npm run typecheck
npm run lint
npm run build
```

The artifact-generation environment itself exposed Node 22.16, so exact Node 24 runtime execution was not available there. Local development, CI and Docker are hard-pinned to Node 24.18.0 and are the required execution environments.

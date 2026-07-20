#!/usr/bin/env sh
set -eu
npm run typecheck
npm run lint
npm run build
if command -v rg >/dev/null 2>&1; then
  if rg 'Ã|Ä|á»|áº|Â|�' docs .cursor server shared client; then
    echo 'Possible Vietnamese encoding corruption found.' >&2
    exit 1
  fi
fi

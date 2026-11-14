#!/usr/bin/env bash
# Run an app command (npm/npx) for the Node app. Exception: a copy with no node_modules AND no git origin (the template's
# own bootstrap tests snapshot the repo that way) skips with a message, so factory.json commands can stay set.
# A real checkout (origin set) without node_modules fails loudly: run `npm ci`.
if [ ! -f package.json ] || { [ ! -d node_modules ] && ! git remote get-url origin >/dev/null 2>&1; }; then
  echo "app.sh: no Node app or dependencies in this copy, skipping: $*"
  exit 0
fi
exec "$@"

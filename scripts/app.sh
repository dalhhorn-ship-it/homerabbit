#!/usr/bin/env bash
# Run an app command (npm/npx) for the Node app. Never skips: a missing node_modules is an error (TD-027).
if [ ! -d node_modules ]; then
  echo "app.sh: node_modules is missing, so '$*' cannot run. Run 'npm ci' first." >&2
  exit 1
fi
exec "$@"

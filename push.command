#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "→ $(pwd)"
rm -f .git/index.lock 2>/dev/null || true
git add -A
if git diff --cached --quiet && [ -z "$(git log @{u}..HEAD --oneline 2>/dev/null)" ]; then
  echo "Nothing to push."
else
  if ! git diff --cached --quiet; then
    git commit -m "${1:-update webpage}"
  fi
  git push
  echo "✓ pushed"
fi
echo
read -n 1 -s -r -p "Press any key to close…"

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
# Close this Terminal window once the script finishes.
# We match the window whose tab is running on the current tty.
TTY="$(tty)"
osascript >/dev/null 2>&1 <<EOF &
tell application "Terminal"
  repeat with w in windows
    repeat with t in tabs of w
      if tty of t is "$TTY" then
        close w saving no
        return
      end if
    end repeat
  end repeat
end tell
EOF
exit 0

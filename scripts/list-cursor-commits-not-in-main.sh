#!/usr/bin/env bash
# List commits reachable from origin/cursor/* remotes but not origin/main,
# oldest-first by committer date, de-duplicated. Use as input for cherry-pick
# consolidation (see .cursor/rules/cursor-agent-branch-hygiene.mdc).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

git fetch origin --prune

main_ref="origin/main"
if ! git rev-parse --verify "$main_ref" >/dev/null 2>&1; then
  echo "error: $main_ref not found" >&2
  exit 1
fi

refs=()
while IFS= read -r line; do
  [ -n "$line" ] && refs+=("$line")
done < <(
  git branch -r |
    sed 's/^ *//' |
    grep -E '^origin/cursor/' |
    grep -vi codex |
    grep -vi codec ||
    true
)

if [ "${#refs[@]}" -eq 0 ]; then
  echo "No origin/cursor/* remotes found (codex/codec names excluded)."
  exit 0
fi

echo "=== Remotes (not in $main_ref) ==="
for r in "${refs[@]}"; do
  n=$(git rev-list --count "$main_ref".."$r" 2>/dev/null || echo 0)
  echo "$r  ($n commits ahead of $main_ref)"
done
echo

echo "=== Per-branch log (newest first) ==="
for r in "${refs[@]}"; do
  echo "--- $r ---"
  git log --oneline "$main_ref".."$r" 2>/dev/null || echo "(no unique commits or missing ref)"
  echo
done

echo "=== Suggested cherry-pick order (oldest first, unique SHAs) ==="
git rev-list --reverse --date-order "${refs[@]}" "^$main_ref" 2>/dev/null |
  while read -r sha; do
    [ -n "$sha" ] && git log -1 --format='%h %ci %s' "$sha"
  done

echo
echo "=== Full SHAs (for scripts) ==="
git rev-list --reverse --date-order "${refs[@]}" "^$main_ref" 2>/dev/null

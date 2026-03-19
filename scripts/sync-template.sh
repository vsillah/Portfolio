#!/bin/bash
# Sync a client template to its standalone GitHub repo.
#
# Usage:
#   bash scripts/sync-template.sh chatbot-template [changelog message]
#
# This script:
#   1. Clones the target repo to a temp directory
#   2. Syncs src/, database/, n8n-workflows/, scripts/, .github/ from the template
#   3. Syncs root config files (package.json, tsconfig.json, etc.)
#   4. Does NOT overwrite config/ (buyer's territory)
#   5. Commits, tags, and pushes
#   6. Optionally fires repository_dispatch to client repos

set -euo pipefail

TEMPLATE_NAME="${1:?Usage: sync-template.sh <template-name> [changelog]}"
CHANGELOG="${2:-Bug fixes and improvements}"
TEMPLATE_DIR="client-templates/$TEMPLATE_NAME"
DIST_REPO="vsillah/$TEMPLATE_NAME"
VERSION_TAG="$(date +%Y-%m-%d)-$(git rev-parse --short HEAD)"
TEMP_DIR="/tmp/${TEMPLATE_NAME}-sync"

if [ ! -d "$TEMPLATE_DIR" ]; then
  echo "Error: $TEMPLATE_DIR does not exist"
  exit 1
fi

echo "=== Syncing $TEMPLATE_NAME to $DIST_REPO ==="
echo "Version: $VERSION_TAG"
echo ""

# Clone the distribution repo
rm -rf "$TEMP_DIR"
git clone "https://github.com/$DIST_REPO.git" "$TEMP_DIR"

# Sync seller-territory files (src/, database/, n8n-workflows/, scripts/, .github/)
echo "Syncing src/ ..."
rsync -av --delete "$TEMPLATE_DIR/src/" "$TEMP_DIR/src/"

echo "Syncing database/ ..."
rsync -av --delete "$TEMPLATE_DIR/database/" "$TEMP_DIR/database/"

echo "Syncing n8n-workflows/ ..."
rsync -av --delete "$TEMPLATE_DIR/n8n-workflows/" "$TEMP_DIR/n8n-workflows/"

echo "Syncing scripts/ ..."
rsync -av --delete "$TEMPLATE_DIR/scripts/" "$TEMP_DIR/scripts/"

echo "Syncing .github/ ..."
rsync -av --delete "$TEMPLATE_DIR/.github/" "$TEMP_DIR/.github/"

# Sync root config files (these are seller-maintained)
for file in package.json tsconfig.json tailwind.config.ts next.config.js postcss.config.js .gitignore .env.example template.json README.md CONTRIBUTING.md INSTALL.md; do
  if [ -f "$TEMPLATE_DIR/$file" ]; then
    cp "$TEMPLATE_DIR/$file" "$TEMP_DIR/$file"
  fi
done

# Do NOT sync config/ — that's the buyer's territory
echo ""
echo "Skipping config/ (buyer's territory)"

# Commit and push
cd "$TEMP_DIR"
git add -A

if git diff --cached --quiet; then
  echo ""
  echo "No changes to sync."
  rm -rf "$TEMP_DIR"
  exit 0
fi

git commit -m "update: $VERSION_TAG

$CHANGELOG"

git tag "$VERSION_TAG"
git push origin main --tags

echo ""
echo "=== Sync complete ==="
echo "Pushed to: https://github.com/$DIST_REPO"
echo "Tag: $VERSION_TAG"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"

echo "To notify client repos, run:"
echo "  node scripts/notify-client-repos.js $TEMPLATE_NAME $VERSION_TAG"

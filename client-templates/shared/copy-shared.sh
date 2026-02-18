#!/bin/bash
# Copy Shared Utilities to Template
# Usage: ./copy-shared.sh <target-template-path>
#
# Example:
#   ./copy-shared.sh ../chatbot-template
#   ./copy-shared.sh /path/to/my-new-project

set -e

TARGET=$1

if [ -z "$TARGET" ]; then
  echo "Usage: ./copy-shared.sh <target-template-path>"
  echo ""
  echo "Examples:"
  echo "  ./copy-shared.sh ../chatbot-template"
  echo "  ./copy-shared.sh /path/to/my-project"
  echo ""
  echo "This script copies shared utilities (supabase, auth, utils) to a template."
  exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if target exists
if [ ! -d "$TARGET" ]; then
  echo "Error: Target directory '$TARGET' does not exist."
  exit 1
fi

# Create lib directory if it doesn't exist
mkdir -p "$TARGET/lib"

# Copy shared utilities
echo "Copying shared utilities to $TARGET/lib/"

cp "$SCRIPT_DIR/lib/supabase.ts" "$TARGET/lib/"
cp "$SCRIPT_DIR/lib/auth.ts" "$TARGET/lib/"
cp "$SCRIPT_DIR/lib/auth-server.ts" "$TARGET/lib/"
cp "$SCRIPT_DIR/lib/utils.ts" "$TARGET/lib/"

echo ""
echo "Done! Copied:"
echo "  - supabase.ts    (Supabase client setup)"
echo "  - auth.ts        (Client-side auth utilities)"
echo "  - auth-server.ts (Server-side auth verification)"
echo "  - utils.ts       (Tailwind utilities)"
echo ""
echo "Note: The template may already have its own supabase.ts and utils.ts."
echo "Review for duplicates and keep the version that fits your needs."

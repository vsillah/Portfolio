#!/bin/bash

echo "🔍 Setting up Database Monitoring System..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local not found"
  echo "Please create .env.local with your Supabase credentials first"
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Initialize husky
echo "🐶 Setting up git hooks..."
npm run prepare

# Make pre-push hook executable
chmod +x .husky/pre-push

# Create initial baseline
echo "📊 Creating database baseline..."
npm run db:health-check

# Check if baseline was created
if [ -f .database-baseline.json ]; then
  echo ""
  echo "✅ Monitoring system installed successfully!"
  echo ""
  echo "📝 Next steps:"
  echo "  1. Review .database-baseline.json"
  echo "  2. Commit the baseline: git add .database-baseline.json && git commit -m 'Add DB monitoring'"
  echo "  3. Test it: Make a change and try to push"
  echo ""
  echo "📖 Read DATABASE_MONITORING.md for full documentation"
else
  echo ""
  echo "⚠️  Baseline file was not created"
  echo "Check your Supabase credentials in .env.local"
  exit 1
fi

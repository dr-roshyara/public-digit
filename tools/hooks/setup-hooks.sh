#!/usr/bin/env sh

echo "🔧 Setting up Git hooks for architecture validation..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "❌ Error: Not a git repository!"
  exit 1
fi

# Copy pre-commit hook to .git/hooks
cp tools/hooks/pre-commit .git/hooks/pre-commit

# Make it executable
chmod +x .git/hooks/pre-commit

echo "✅ Git hooks installed successfully!"
echo "\n📝 The following hooks are now active:"
echo "   - pre-commit: Architecture validation + linting"
echo "\n💡 Hooks will run automatically before each commit."
echo "   To bypass hooks temporarily (not recommended):"
echo "   git commit --no-verify"

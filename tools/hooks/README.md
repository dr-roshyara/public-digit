# Git Hooks for Architecture Validation

This directory contains Git hooks for automated architecture validation and code quality checks.

## Setup

### Quick Setup

```bash
# Run the setup script
sh tools/hooks/setup-hooks.sh
```

### Manual Setup

```bash
# Copy pre-commit hook to git hooks directory
cp tools/hooks/pre-commit .git/hooks/pre-commit

# Make it executable (Unix/Mac)
chmod +x .git/hooks/pre-commit

# On Windows with Git Bash
chmod +x .git/hooks/pre-commit
```

### Alternative: Using Husky (Optional)

If you prefer using Husky for hook management:

```bash
# Install Husky
npm install --save-dev husky

# Initialize Husky
npx husky init

# Create pre-commit hook
npx husky add .husky/pre-commit "node tools/scripts/validate-architecture.js"
npx husky add .husky/pre-commit "npx nx lint mobile --quiet"
```

## Hooks

### Pre-Commit Hook

Runs before each commit and performs:

1. **Architecture Validation**
   - Checks module boundaries
   - Validates layer separation (Domain, Application, Infrastructure, Presentation)
   - Ensures no forbidden imports (e.g., Domain → Infrastructure)

2. **Linting**
   - Runs ESLint on mobile app
   - Checks for code quality issues

### Hook Behavior

- ✅ **Passes**: Commit proceeds normally
- ❌ **Fails**: Commit is blocked, errors are displayed

## Bypassing Hooks

**Not recommended**, but you can bypass hooks with:

```bash
git commit --no-verify
```

Use this only in exceptional circumstances (e.g., emergency hotfix).

## Troubleshooting

### Hook Not Running

1. Check if hook file exists: `ls -la .git/hooks/pre-commit`
2. Check if hook is executable: `chmod +x .git/hooks/pre-commit`
3. Verify you're in the repository root when committing

### Hook Failing

1. Run the validation script manually:
   ```bash
   node tools/scripts/validate-architecture.js
   ```

2. Run linting manually:
   ```bash
   npx nx lint mobile
   ```

3. Fix reported issues before committing

### Architecture Violations

If architecture validation fails:

1. Review the violation details
2. Fix imports to respect layer boundaries:
   - Presentation → Application only
   - Application → Domain only
   - Infrastructure → Domain (implements interfaces)
   - Domain → Nothing (pure business logic)
3. Run validation again to confirm fix

### Linting Failures

If linting fails:

1. Run auto-fix:
   ```bash
   npx nx lint mobile --fix
   ```

2. Manually fix remaining issues
3. Commit changes

## Disabling Hooks

To temporarily disable hooks (e.g., for testing):

```bash
# Rename the hook
mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled

# Re-enable later
mv .git/hooks/pre-commit.disabled .git/hooks/pre-commit
```

## CI/CD Integration

The same checks should run in CI/CD:

```yaml
# Example: GitHub Actions
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Architecture Validation
        run: node tools/scripts/validate-architecture.js
      - name: Linting
        run: npx nx lint mobile
```

## Hooks Best Practices

1. **Keep hooks fast** - Slow hooks discourage commits
2. **Be deterministic** - Same code should always pass/fail
3. **Provide clear error messages** - Help developers fix issues
4. **Allow bypass for emergencies** - But document when/why
5. **Mirror CI/CD checks** - Local hooks should match pipeline

## Architecture Validation Details

The pre-commit hook validates:

- **Module Boundaries**: No violations of `@nx/enforce-module-boundaries`
- **Layer Separation**:
  - Presentation layer doesn't import Domain directly
  - Domain layer doesn't import Presentation
  - Domain layer doesn't import Infrastructure
- **Clean Architecture**: Dependency flow is enforced

## Additional Hooks (Future)

Consider adding:

- **Pre-Push Hook**: Run full test suite before pushing
- **Commit-Msg Hook**: Enforce commit message format
- **Post-Checkout Hook**: Remind to run `npm install` after branch switch

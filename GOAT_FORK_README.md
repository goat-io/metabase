# GOAT.io Metabase Fork

This is GOAT.io's fork of [Metabase](https://github.com/metabase/metabase) with custom enhancements.

## Custom Features

### 1. Stored Procedures and Functions Sync
- **Branch**: `feature/stored-procedures-clean`
- **Status**: Production Ready
- Syncs stored procedures and functions from databases
- Makes them available in SQL editor autocomplete
- Currently supports PostgreSQL (11+)

### 2. Action ResultSet Support
- **Branch**: `feature/action-resultset-support`
- **Status**: Production Ready, Upstream Candidate
- Enables actions to execute queries that return data
- Supports stored procedures and functions that return values
- Maintains backward compatibility with UPDATE/INSERT/DELETE actions

### 3. Success Message Templates
- **Branch**: `feature/success-message-templates`
- **Status**: Production Ready
- Adds template variable support to action success messages
- Supports `{{variableName}}` syntax with nested path access
- Example: `Order {{orderId}} created with total {{totalAmount}}`

### 4. Embedded Actions Support (Already in Master)
- **Status**: Production Ready
- Always enables actions (bypasses database-level action permissions)
- Makes action cards visible in embedded dashboards
- Adds click event support for iframe communication
- JWT parsing for embedded dashboard actions
- Request auth tokens from parent window for embedded scenarios

## Branch Structure

- `master` - Our production branch with all custom features
- `feature/*` - Individual feature branches for isolated changes
- `upstream/master` - Tracks official Metabase repository

## Development Workflow

### Setting Up
```bash
# Clone the repository
git clone git@github.com:goat-io/metabase.git
cd metabase

# Add upstream remote
git remote add upstream https://github.com/metabase/metabase.git
git fetch upstream
```

### Creating New Features
```bash
# Create feature branch from upstream
git checkout -b feature/my-feature upstream/master

# Make changes...

# Commit with descriptive prefix
git commit -m "[CUSTOM] feat: My new feature"  # For GOAT-specific features
git commit -m "[UPSTREAM] fix: Bug fix"        # For potential upstream contributions
```

### Updating from Upstream
```bash
# Fetch latest upstream changes
git fetch upstream

# Update feature branches
git checkout feature/my-feature
git rebase upstream/master

# Update master
git checkout master
git merge upstream/master
```

## Building and Running

Follow the standard [Metabase development guide](https://github.com/metabase/metabase/blob/master/docs/developers-guide/start.md).

### Quick Start
```bash
# Backend
clojure -M:run

# Frontend
yarn && yarn build-hot
```

### Running with Custom Features
All custom features are enabled by default when running from the master branch.

## Testing

### Stored Procedures
1. Create procedures in your PostgreSQL database
2. Sync the database in Admin → Databases
3. Check autocomplete in SQL editor

### Action ResultSet
1. Create an action that executes a SELECT or function
2. Run the action
3. Check the API response for `{rows: [...], columns: [...]}`

### Success Message Templates
1. Create an action with a success message containing `{{variables}}`
2. Execute the action
3. Verify the interpolated message

## Contributing

### To This Fork
1. Create a feature branch
2. Make changes following Metabase coding standards
3. Test thoroughly
4. Create PR against our master branch

### To Upstream Metabase
Features marked as "Upstream Candidate" can be contributed back:
1. Create a clean branch from upstream/master
2. Cherry-pick relevant commits
3. Follow [Metabase contribution guidelines](https://github.com/metabase/metabase/blob/master/CONTRIBUTING.md)
4. Submit PR to metabase/metabase

## Maintenance

### Keeping Features Updated
```bash
# Update all feature branches after upstream changes
for branch in $(git branch -r | grep 'origin/feature'); do
  git checkout ${branch#origin/}
  git rebase upstream/master
done
```

### Resolving Conflicts
When rebasing feature branches:
1. Resolve conflicts preserving our functionality
2. Test the feature still works
3. Update feature branch
4. Merge into master

## Support

For issues specific to our fork, please create an issue in this repository.
For general Metabase issues, use the [upstream repository](https://github.com/metabase/metabase/issues).
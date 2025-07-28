# Metabase Agent Development Guide

## Commands

### JavaScript/TypeScript
- **Lint**: `yarn lint-eslint-pure`
- **Test**: `yarn test-unit path/to/file.unit.spec.js` or `yarn test-unit -t "pattern"`
- **Watch**: `yarn test-unit-watch path/to/file.unit.spec.js`
- **Format**: `yarn prettier`
- **Type Check**: `yarn type-check-pure`

### Clojure
- **Lint**: `./bin/mage kondo <file>` or `./bin/mage kondo-updated HEAD`
- **Format**: `./bin/mage cljfmt-files [path]`
- **Test**: `clojure -X:dev:test :only namespace/test-name`
- **Check Syntax**: `./bin/mage -check-readable <file> <line-number>`
- **REPL**: `./bin/mage -repl --namespace your.namespace '(your-function args)'`

## Code Style

### Frontend
- Use TypeScript (.tsx for components, .ts for utilities)
- Prefer `metabase/ui` components over `metabase/common/components`
- Styling: Mantine style props > CSS modules. NO styled-components
- Imports: Group by builtin/external/internal/parent/sibling/index, alphabetized
- Localization: Use ttag library, complete phrases not concatenated strings
- Testing: Jest + React Testing Library, prefer unit over E2E tests

### Clojure
- Format with cljfmt (community-style function args indentation)
- Sort namespace references alphabetically
- Check syntax after EVERY change with `-check-readable`
- Use REPL-driven development: test small functions first, compose up
# Scaffolding Checklist

Detailed checklist for repo initialization. Adapt commands to the tech stack from
SPECS.md and ARCHITECTURE.md. This checklist assumes a common modern web stack but
every item should be adjusted to match the actual project.

---

## 1. Project Init

| Check | Command / Action |
|-------|-----------------|
| Create branch | `git checkout -b impl/spec-<YYYY-MM-DD-HHmm>` |
| Init project | Framework-specific init command (see SKILL.md Step 3) |
| Verify package.json | Name, version, engine constraints |
| Verify tsconfig.json | `strict: true`, path aliases, target |
| Clean boilerplate | Remove default pages, styles, assets that don't match architecture |

## 2. Dependencies

### Production (from ARCHITECTURE.md section 2.1)

Read the "Final Stack" table and install every listed production dependency at the
specified version. Common categories:

- Framework (Next.js, Remix, Astro, etc.)
- ORM (Drizzle, Prisma, etc.) + database driver
- UI components library (shadcn/ui, Radix, etc.)
- State management (Zustand, Jotai, etc.)
- Styling runtime (Tailwind CSS, etc.)
- Validation (Zod, Yup, etc.)
- Markdown / content (react-markdown, MDX, etc.)
- File handling (archiver, gray-matter, etc.)

### Dev Dependencies

- TypeScript (exact version from architecture)
- ESLint + plugins (`@typescript-eslint/*`, framework plugin)
- Prettier + ESLint config (`eslint-config-prettier`)
- Test runner (`vitest`, `jest`, etc.) + testing libraries
- E2E runner (`@playwright/test`, `cypress`, etc.)
- BDD plugin (`playwright-bdd`, `cucumber`, etc.)
- Commit tooling: `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`
- Type utilities (`@types/*` packages for untyped deps)

## 3. Tooling Configuration

### TypeScript — `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",  // for React frameworks
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist", ".next"]
}
```

Adapt paths, target, and module to framework requirements.

### ESLint

Common configuration pattern:

```javascript
// eslint.config.mjs (flat config) or .eslintrc.json
{
  extends: [
    "next/core-web-vitals",          // or framework equivalent
    "plugin:@typescript-eslint/recommended",
    "prettier"                        // must be last
  ],
  rules: {
    "no-unused-vars": "warn",
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  }
}
```

### Prettier — `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "bracketSpacing": true
}
```

### Commitlint — `commitlint.config.js`

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'chore', 'test', 'refactor', 'docs', 'style', 'ci'
    ]],
    'scope-case': [2, 'always', 'kebab-case'],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
  }
};
```

### Lint-staged

In `package.json` or `.lintstagedrc.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --max-warnings 0",
      "prettier --write"
    ],
    "*.{json,md,css}": [
      "prettier --write"
    ]
  }
}
```

### Test Runner (Vitest example)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node', // or 'jsdom' for component tests
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
    },
  },
});
```

### E2E Runner (Playwright example)

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### ORM (Drizzle example)

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/modules/*-infra/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/flashcards.db',
  },
});
```

## 4. Husky Setup

```bash
# Initialize husky
npx husky init

# Pre-commit: lint-staged
echo '#!/bin/sh\nnpx lint-staged' > .husky/pre-commit

# Commit-msg: commitlint
echo '#!/bin/sh\nnpx commitlint --edit "$1"' > .husky/commit-msg

# Pre-push: type check + tests
echo '#!/bin/sh\nnpm run typecheck && npm run test -- --run' > .husky/pre-push
```

Make hooks executable: `chmod +x .husky/*`

## 5. Claude Hooks Setup

### Create hook script

```bash
mkdir -p .claude/hooks
cat > .claude/hooks/quality-gate.sh << 'SCRIPT'
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  npx eslint --fix "$FILE_PATH" 2>/dev/null
  npx prettier --write "$FILE_PATH" 2>/dev/null
fi

if [[ "$FILE_PATH" =~ \.(json|md|css)$ ]]; then
  npx prettier --write "$FILE_PATH" 2>/dev/null
fi

exit 0
SCRIPT
chmod +x .claude/hooks/quality-gate.sh
```

### Create project settings

```bash
cat > .claude/settings.json << 'SETTINGS'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/quality-gate.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
SETTINGS
```

## 6. Verification Checklist

Run each of these. All must pass before committing:

- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npm run lint` — zero lint errors
- [ ] `npx prettier --check .` — all files formatted
- [ ] `npm test` — test runner works (0 tests OK)
- [ ] Create a test commit with bad message — commitlint rejects it
- [ ] Create a test commit with valid message — lint-staged runs, commit succeeds
- [ ] Verify `.gitignore` excludes: `node_modules/`, `data/`, `*.db`, `.env*`, build output

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

envar-mash combines environment variables from multiple sources into a single output file. It processes `.env` template files with placeholder substitution and inheritance cascades.

## Build Commands

```bash
yarn build          # Compile TypeScript to dist/
yarn package        # Bundle with ncc for distribution
yarn all            # Build then package
yarn test           # Run Jest tests (with cleanup)
yarn test:inspect   # Run tests without cleanup (examine output files)
```

## Architecture

The codebase is a TypeScript CLI with three modules:

- **main.ts** - Entry point and file orchestration. Processes env files in precedence order:
  1. `.env.ALL-after` (lowest precedence, loaded first)
  2. `.env.ALL-before`
  3. `.env.{ENV}` (environment-specific)
  4. `.env.{ENV}.template` (target template, highest precedence)

- **line-parser.ts** - State machine parser handling quotes, escapes, comments, and `${placeholder}` substitution. States: `normal`, `single-quote`, `double-quote`, `maybe-placeholder`, `escaping`. Tracks `LinePivot` to distinguish key vs value parsing.

- **context.ts** - Type definitions for `Context` (key-value map) and `resolve()` function that looks up placeholders first in process.env, then in accumulated logic context

## Key Concepts

- **MashRequest**: Core input with `dirTop` (source env files), `dirTarget` (template location), `environmentName`, and `listenerType`
- **Placeholder resolution**: `${KEY}` syntax resolves against process.env first, then the accumulated logic context
- **Quoted value handling**: Double-quoted values have quotes stripped and escapes resolved (`\"` → `"`, `\\` → `\`). Unclosed quotes are kept literal.
- **FileListener**: Handles events like `onMissingPlaceholder` and `onNoKeyPair` (throw error or warn)

## Test Harness Structure (impl/)

The `impl/` directory contains test harness filesystems, not tests themselves. Each direct child is a **SOCKET** - a namespaced folder for test scenarios.

```
impl/
├── {SOCKET}/
│   ├── env/functions/           # dirTop - source env files
│   │   ├── .env.ALL-before      # optional
│   │   ├── .env.ALL-after       # optional
│   │   └── .env.{ENV}           # environment-specific values
│   ├── functions/               # dirTarget example
│   │   └── .env.{ENV}.template
│   └── microservices/
│       └── service-{SERVICE}/functions/  # another dirTarget example
│           └── .env.{ENV}.template
```

**SOCKETs:**
- `cascade` - Full cascade with ALL-before, ALL-after, and env-specific
- `no-all` - No ALL-before or ALL-after (env-specific only)
- `only-before` - Has ALL-before, no ALL-after
- `only-after` - Has ALL-after, no ALL-before
- `simple`, `quoted`, `placeholders` - Unit test scenarios for parseFile

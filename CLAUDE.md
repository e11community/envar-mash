# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

envar-mash combines environment variables from multiple sources into a single output file. It processes `.env` template files with placeholder substitution and inheritance cascades.

## Build Commands

```bash
yarn build          # Compile TypeScript to dist/
yarn test           # Run Jest tests (with cleanup)
yarn test:inspect   # Run tests without cleanup (examine output files)
```

## CLI Usage

```bash
envar-mash [--top=PATH] [--target=PATH] [--listener=throw|warn]
```

- `--top` - Path to directory containing source .env files (default: `{project}/env/functions` where `{project}` is the directory containing yarn.lock)
- `--target` - Path to directory containing `.env.*.template` files (default: current working directory)
- `--listener` - How to handle missing placeholders: `throw` or `warn` (default: `warn`)

Environments are auto-discovered from `.env.*.template` files in the target directory. Environment names must be lowercase letters only (e.g., `dev`, `qa`, `prod`).

## Architecture

The codebase is a TypeScript CLI with four modules:

- **cli.ts** - CLI entry point. Parses arguments, finds project root via yarn.lock, calls main.

- **main.ts** - File orchestration. Auto-discovers ENVs from template files, processes env files in order:
  1. `.env.ALL-before` (from dirTop, processed once, state saved)
  2. `.env.{ENV}` (from dirTop, environment-specific)
  3. `.env.{ENV}.template` (from dirTarget)
  4. `.env.ALL-after` (from dirTop)

  All keypairs from all sources are output to `.env.{ENV}` in processing order.

- **line-parser.ts** - State machine parser handling quotes, escapes, comments, and `${placeholder}` substitution. States: `normal`, `single-quote`, `double-quote`, `maybe-placeholder`, `escaping`. Tracks `LinePivot` to distinguish key vs value parsing.

- **context.ts** - Type definitions for `Context` (key-value map) and `resolve()` function that looks up placeholders first in process.env, then in accumulated logic context

## Key Concepts

- **MashRequest**: Core input with `dirTop` (source env files), `dirTarget` (template location), and `listenerType`
- **Placeholder resolution**: `${KEY}` syntax resolves against process.env first, then the accumulated logic context. Templates can only reference values from ALL-before or .env.{ENV}, not from ALL-after.
- **Quoted value handling**: Double-quoted values have quotes stripped and escapes resolved (`\"` → `"`, `\\` → `\`). Unclosed quotes are kept literal.
- **FileListener**: Handles events like `onMissingPlaceholder` and `onNoKeyPair` (throw error or warn)
- **parseFile**: Returns the processed buffer string and optionally writes to outputPath

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

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

envar-mash combines environment variables from multiple sources into a single output file. It processes `.env` template files with placeholder substitution and inheritance cascades.

## Build Commands

```bash
yarn build          # Compile TypeScript to dist/
yarn package        # Bundle with ncc for distribution
yarn all            # Build then package
```

## Architecture

The codebase is a simple TypeScript CLI with three modules:

- **main.ts** - Entry point and file orchestration. Processes env files in precedence order:
  1. `.env.ALL-after` (lowest precedence, loaded first)
  2. `.env.ALL-before`
  3. `.env.{ENV}` (environment-specific)
  4. `.env.{ENV}.template` (target template, highest precedence)

- **line-parser.ts** - State machine parser handling quotes, escapes, comments, and `${placeholder}` substitution. States: `normal`, `single-quote`, `double-quote`, `maybe-placeholder`, `escaping`

- **context.ts** - Type definitions for `Context` (key-value map) and `resolve()` function that looks up placeholders first in process.env, then in accumulated logic context

## Key Concepts

- **Placeholder resolution**: `${KEY}` syntax resolves against process.env first, then the accumulated logic context
- **Listener pattern**: `PlaceholderListener` handles missing keys (throw error or warn)
- **Buffering**: Output file content is only buffered when `outputPath` is specified

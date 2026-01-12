# Running envar-mash

This document explains how to integrate envar-mash into your project.

## Installation

```bash
yarn add -D @e11community/envar-mash
```

## package.json Setup

Add a script to generate your environment files:

```json
{
  "scripts": {
    "env:generate": "envar-mash"
  }
}
```

### With Custom Paths

If your project structure differs from the defaults:

```json
{
  "scripts": {
    "env:generate": "envar-mash --top=./config/env --target=./src"
  }
}
```

### Options

- `--top=PATH` - Directory containing source `.env` files (default: `{project}/env/functions`)
- `--target=PATH` - Directory containing `.env.*.template` files (default: current working directory)
- `--listener=throw|warn` - How to handle missing placeholders (default: `warn`)

## Firebase Predeploy

To generate environment files before each Firebase deployment, add envar-mash to your `firebase.json` predeploy hooks:

```json
{
  "functions": {
    "source": "functions",
    "predeploy": [
      "yarn env:generate"
    ]
  }
}
```

### Multiple Function Directories

For monorepos with multiple function directories:

```json
{
  "functions": [
    {
      "source": "functions/api",
      "predeploy": [
        "yarn env:generate --target=functions/api"
      ]
    },
    {
      "source": "functions/workers",
      "predeploy": [
        "yarn env:generate --target=functions/workers"
      ]
    }
  ]
}
```

## Expected Directory Structure

```
your-project/
├── yarn.lock                    # Used to find project root
├── env/
│   └── functions/               # Default --top location
│       ├── .env.ALL-before      # Applied first (optional)
│       ├── .env.dev             # Environment-specific values
│       ├── .env.qa
│       ├── .env.prod
│       └── .env.ALL-after       # Applied last (optional)
├── functions/                   # Default --target location
│   ├── .env.dev.template        # Template files
│   ├── .env.qa.template
│   └── .env.prod.template
└── package.json
```

## Processing Order

For each discovered environment (e.g., `dev`, `qa`, `prod`):

1. `.env.ALL-before` from `--top` (if present)
2. `.env.{ENV}` from `--top` (if present)
3. `.env.{ENV}.template` from `--target`
4. `.env.ALL-after` from `--top` (if present)

Later files override earlier ones. The output is deduplicated by key and sorted alphabetically.

## Template Syntax

Templates support `${PLACEHOLDER}` syntax:

```bash
# .env.dev.template
SERVICE_NAME=my-service
DATABASE_URL=${DATABASE_URL}
API_KEY=${API_KEY}
```

Placeholders resolve from:
1. Process environment variables (highest priority)
2. Values from previously processed files in the chain

## Output

Running envar-mash generates `.env.{ENV}` files in the target directory:

```
functions/
├── .env.dev.template    # Input
├── .env.dev             # Generated output
├── .env.qa.template
├── .env.qa
├── .env.prod.template
└── .env.prod
```

Add generated files to `.gitignore`:

```gitignore
# Generated environment files
functions/.env.dev
functions/.env.qa
functions/.env.prod
```

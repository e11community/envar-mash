#!/usr/bin/env node
import {existsSync} from 'fs'
import {dirname, join} from 'path'
import {main} from './main'

function parseArgs(args: string[]): {top?: string; target?: string; env?: string; listener?: string} {
  const result: {top?: string; target?: string; env?: string; listener?: string} = {}

  for (const arg of args) {
    if (arg.startsWith('--top=')) {
      result.top = arg.slice(6)
    } else if (arg.startsWith('--target=')) {
      result.target = arg.slice(9)
    } else if (arg.startsWith('--env=')) {
      result.env = arg.slice(6)
    } else if (arg.startsWith('--listener=')) {
      result.listener = arg.slice(11)
    }
  }

  return result
}

/**
 * Walks up from startDir looking for yarn.lock.
 * Returns the directory containing yarn.lock, or undefined if not found.
 */
function findProjectRoot(startDir: string): string | undefined {
  let dir = startDir
  while (true) {
    if (existsSync(join(dir, 'yarn.lock'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return undefined
    }
    dir = parent
  }
}

function printUsage(): void {
  console.error(`Usage: envar-mash --env=ENV [--top=PATH] [--target=PATH] [--listener=throw|warn]

Required:
  --env=ENV       Environment name (e.g., dev, qa, prod)

Optional:
  --top=PATH      Path to directory containing source .env files
                  Default: {project}/env/functions
                  ({project} is the directory containing yarn.lock)

  --target=PATH   Path to directory containing .env.{ENV}.template
                  Default: current working directory

  --listener=throw|warn
                  How to handle missing placeholders (default: warn)`)
}

const args = parseArgs(process.argv.slice(2))

if (!args.env) {
  printUsage()
  process.exit(1)
}

// Default --target to CWD
const dirTarget = args.target ?? process.cwd()

// Default --top to {project}/env/functions
let dirTop: string
if (args.top) {
  dirTop = args.top
} else {
  const projectRoot = findProjectRoot(process.cwd())
  if (!projectRoot) {
    console.error('Could not find project root (no yarn.lock found in parent directories)')
    console.error('Please specify --top=PATH explicitly')
    process.exit(1)
  }
  dirTop = join(projectRoot, 'env', 'functions')
}

const listenerType = args.listener === 'throw' ? 'throw' : 'warn'

const exitCode = main({
  dirTop,
  dirTarget,
  environmentName: args.env,
  listenerType,
})

process.exit(exitCode)

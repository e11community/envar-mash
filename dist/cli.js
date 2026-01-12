#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const main_1 = require("./main");
function parseArgs(args) {
    const result = {};
    for (const arg of args) {
        if (arg.startsWith('--top=')) {
            result.top = arg.slice(6);
        }
        else if (arg.startsWith('--target=')) {
            result.target = arg.slice(9);
        }
        else if (arg.startsWith('--env=')) {
            result.env = arg.slice(6);
        }
        else if (arg.startsWith('--listener=')) {
            result.listener = arg.slice(11);
        }
    }
    return result;
}
/**
 * Walks up from startDir looking for yarn.lock.
 * Returns the directory containing yarn.lock, or undefined if not found.
 */
function findProjectRoot(startDir) {
    let dir = startDir;
    while (true) {
        if ((0, fs_1.existsSync)((0, path_1.join)(dir, 'yarn.lock'))) {
            return dir;
        }
        const parent = (0, path_1.dirname)(dir);
        if (parent === dir) {
            return undefined;
        }
        dir = parent;
    }
}
function printUsage() {
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
                  How to handle missing placeholders (default: warn)`);
}
const args = parseArgs(process.argv.slice(2));
if (!args.env) {
    printUsage();
    process.exit(1);
}
// Default --target to CWD
const dirTarget = args.target ?? process.cwd();
// Default --top to {project}/env/functions
let dirTop;
if (args.top) {
    dirTop = args.top;
}
else {
    const projectRoot = findProjectRoot(process.cwd());
    if (!projectRoot) {
        console.error('Could not find project root (no yarn.lock found in parent directories)');
        console.error('Please specify --top=PATH explicitly');
        process.exit(1);
    }
    dirTop = (0, path_1.join)(projectRoot, 'env', 'functions');
}
const listenerType = args.listener === 'throw' ? 'throw' : 'warn';
const exitCode = (0, main_1.main)({
    dirTop,
    dirTarget,
    environmentName: args.env,
    listenerType,
});
process.exit(exitCode);

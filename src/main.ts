import {readdirSync, readFileSync, statSync, writeFileSync} from 'fs'
import {join} from 'path'
import {Context, ParseContext} from './context'
import {ParseState, FileListener, ThrowingFileListener, WarningFileListener, parseLine, LinePivot} from './line-parser'

type MashRequest = {
  readonly dirTarget: string
  readonly dirTop: string
  readonly listenerType: 'throw' | 'warn'
}

type ParseFileRequest = {
  /** Path to file to be parsed for variables. */
  readonly filePath: string

  /**
   * Write placeholder resolution of **filePath** to this **path**.
   * If undefined, no file output.
   */
  readonly outputPath?: string

  /** Process environment variables. Highest precedence for placeholder resolution. */
  readonly env: Readonly<Context>

  /**
   * Strategy for handling placeholder events, such as not being resolved.
   */
  readonly listener: FileListener

  /**
   * Mutable logical context.
   * As variables are resolved, this object is updated.
   * Lower precedence for placeholder resolution.
   */
  readonly logic: Context
}

export function parseFile(request: ParseFileRequest): string {
  const {env, filePath, listener, logic, outputPath} = request
  const contents = readFileSync(filePath, {encoding: 'utf8'})
  const lines = contents.split('\n')
  let data = ''
  let curState: ParseState = 'normal'
  let curLinePivot: LinePivot = 'key'
  for (let iLine = 0; iLine < lines.length; ++iLine) {
    const parseContext: ParseContext = {
      col: 1,
      filePath,
      line: iLine + 1,
    }
    const response = parseLine({
      curState,
      env,
      line: lines[iLine],
      listener,
      logic,
      parseContext,
    })
    curState = response.curState
    curLinePivot = response.curLinePivot
    const {buffer} = response
    if (buffer.trim().length === 0) continue
    if (curLinePivot === 'key') listener.onNoKeyPair(parseContext, buffer)
    addendLogic(logic, buffer)
    data += response.buffer + '\n'
  }

  if (outputPath) {
    writeFileSync(outputPath, data, {encoding: 'utf8'})
  }

  return data
}

function addendLogic(logic: Context, line: string): void {
  const iPos = line.indexOf('=')
  const key = line.substring(0, iPos)
  let value = line.substring(iPos + 1)

  if (value.startsWith('"')) {
    // Find the last non-escaped double quote (after the opening one)
    let lastQuotePos = -1
    for (let i = value.length - 1; i >= 1; i--) {
      if (value[i] === '"') {
        // Check if escaped by counting preceding backslashes
        let backslashCount = 0
        for (let j = i - 1; j >= 0 && value[j] === '\\'; j--) {
          backslashCount++
        }
        // If even number of backslashes, quote is not escaped
        if (backslashCount % 2 === 0) {
          lastQuotePos = i
          break
        }
      }
    }

    if (lastQuotePos !== -1) {
      // Strip opening quote
      value = value.substring(1)
      // Adjust position after stripping opening quote
      lastQuotePos--
      // Strip the closing quote and trim trailing whitespace
      value = value.substring(0, lastQuotePos) + value.substring(lastQuotePos + 1).trim()
      // Resolve backslash escaping
      value = value.replace(/\\(.)/g, '$1')
    } else {
      // No closing quote - keep literal but trim trailing whitespace
      value = value.trimEnd()
    }
  }

  logic[key] = value
}

/**
 * Discovers environment names from template files in dirTarget.
 * Looks for files matching `.env.*.template` and extracts the ENV name.
 */
function discoverEnvironments(dirTarget: string): string[] {
  const stat = statSync(dirTarget, {throwIfNoEntry: false})
  if (!stat) return []

  const children = readdirSync(dirTarget, {encoding: 'utf8', recursive: false})
  const envNames: string[] = []

  for (const child of children) {
    const match = child.match(/^\.env\.([a-z]+)\.template$/)
    if (match && match[1]) {
      envNames.push(match[1])
    }
  }

  return envNames
}

export function main(request: MashRequest): number {
  const envNames = discoverEnvironments(request.dirTarget)
  if (envNames.length === 0) {
    return 0
  }

  const env: Context = process.env
  const listener: FileListener = request.listenerType === 'throw' ? ThrowingFileListener : WarningFileListener

  // Process ALL-before once and save the state
  let allBeforeLogic: Context = {}
  let topChildren: string[] = []

  const statTop = statSync(request.dirTop, {throwIfNoEntry: false})
  if (statTop) {
    topChildren = readdirSync(request.dirTop, {encoding: 'utf8', recursive: false})

    if (topChildren.includes('.env.ALL-before')) {
      parseFile({filePath: join(request.dirTop, '.env.ALL-before'), env, listener, logic: allBeforeLogic})
    }
  }

  // Process each discovered environment
  for (const envName of envNames) {
    // Clone the ALL-before logic context for this ENV
    const logic: Context = {...allBeforeLogic}

    // Process env-specific file from dirTop
    if (topChildren.includes('.env.' + envName)) {
      parseFile({filePath: join(request.dirTop, '.env.' + envName), env, listener, logic})
    }

    // Process the template file
    const templatePath = join(request.dirTarget, '.env.' + envName + '.template')
    parseFile({filePath: templatePath, env, listener, logic})

    // Process ALL-after
    if (topChildren.includes('.env.ALL-after')) {
      parseFile({filePath: join(request.dirTop, '.env.ALL-after'), env, listener, logic})
    }

    // Write the deduplicated, sorted output
    const outputPath = join(request.dirTarget, '.env.' + envName)
    const sortedKeys = Object.keys(logic).sort()
    const outputBuffer = sortedKeys.map(key => `${key}=${logic[key]}`).join('\n') + '\n'
    writeFileSync(outputPath, outputBuffer, {encoding: 'utf8'})
  }

  return 0
}

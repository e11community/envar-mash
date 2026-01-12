import {readdirSync, readFileSync, statSync, writeFileSync} from 'fs'
import {join} from 'path'
import {Context, ParseContext} from './context'
import {ParseState, FileListener, ThrowingFileListener, WarningFileListener, parseLine, LinePivot} from './line-parser'

type MashRequest = {
  readonly dirTarget: string
  readonly dirTop: string
  readonly environmentName: string
  readonly listenerType: 'throw' | 'warn'
}

type ParseFileRequest = {
  /** Path to file to be parsed for variables. */
  readonly filePath: string

  /**
   * Write placeholder resolution of **filePath** to this **path**.
   * If undefined, no file output, but logic context is still updated.
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

export function parseFile(request: ParseFileRequest): void {
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
    if (outputPath) {
      data += response.buffer + '\n'
    }
  }

  if (outputPath) {
    writeFileSync(outputPath, data, {encoding: 'utf8'})
  }
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

export function main(request: MashRequest): number {
  const targetPath = join(request.dirTarget, '.env.' + request.environmentName + '.template')
  const statTarget = statSync(targetPath, {throwIfNoEntry: false})
  if (!statTarget) {
    console.log(`File [${targetPath}] is not present. Exiting.`)
    return 0
  }

  const env: Context = process.env
  const logic: Context = {}
  const listener: FileListener = request.listenerType === 'throw' ? ThrowingFileListener : WarningFileListener

  const statTop = statSync(request.dirTop, {throwIfNoEntry: false})
  if (statTop) {
    const children = readdirSync(request.dirTop, {encoding: 'utf8', recursive: false})
    if (children.includes('.env.ALL-after')) {
      parseFile({filePath: join(request.dirTop, '.env.ALL-after'), env, listener, logic})
    }

    if (children.includes('.env.ALL-before')) {
      parseFile({filePath: join(request.dirTop, '.env.ALL-before'), env, listener, logic})
    }

    if (children.includes('.env.' + request.environmentName)) {
      parseFile({filePath: join(request.dirTop, '.env.' + request.environmentName), env, listener, logic})
    }
  }

  parseFile({filePath: targetPath, env, listener, logic, outputPath: '.env.' + request.environmentName})

  return 0
}

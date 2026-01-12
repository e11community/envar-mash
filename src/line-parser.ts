import {Context, ParseContext, resolve} from './context'

export type ParseState = 'normal' | 'single-quote' | 'double-quote' | 'maybe-placeholder' | 'escaping'
export type LinePivot = 'key' | 'value'

export type ParseLineRequest = {
  readonly curLinePivot?: LinePivot
  readonly curState: ParseState
  readonly parseContext: ParseContext
  readonly env: Context
  readonly line: string
  readonly listener: FileListener
  readonly logic: Context
}

export type ParseLineResponse = {
  readonly buffer: string
  readonly curState: ParseState
  readonly curLinePivot: LinePivot
}

export type FileListener = {
  onNoKeyPair: (parseContext: ParseContext, line: string) => void
  onMissingPlaceholder: (parseContext: ParseContext, key: string) => void
}

export const WarningFileListener: FileListener = {
  onNoKeyPair: (parseContext: ParseContext, line: string): void => {
    console.warn(`No keypair detected in content line [${line}] found in file[${parseContext.filePath}] at line [${parseContext.line}]`)
  },
  onMissingPlaceholder: (parseContext: ParseContext, key: string): void => {
    console.warn(
      `Logic contexts have no defined value for key [${key}] found in file [${parseContext.filePath}] at line [${parseContext.line}], col [${parseContext.col}]`,
    )
  },
}

export const ThrowingFileListener: FileListener = {
  onNoKeyPair: (parseContext: ParseContext, line: string): void => {
    throw new Error(`No keypair detected in content line [${line}] found in file[${parseContext.filePath}] at line [${parseContext.line}]`)
  },
  onMissingPlaceholder: (parseContext: ParseContext, key: string) => {
    throw new Error(
      `Logic contexts have no defined value for key [${key}] found in file [${parseContext.filePath}] at line [${parseContext.line}], col [${parseContext.col}]`,
    )
  },
}

export function parseLine(request: ParseLineRequest): ParseLineResponse {
  if (request.line.length === 0) return {buffer: '', curState: request.curState, curLinePivot: request.curLinePivot || 'key'}
  let {curState} = request
  let prevState: ParseState = request.curState
  let curLinePivot = request.curLinePivot || 'key'
  let buffer = ''
  let curChar = ''
  let prevChar = ''
  let posBuffer = 0
  for (let posCur = 0; posCur < request.line.length; ++posCur) {
    prevChar = curChar
    curChar = request.line[posCur]

    if (curState === 'normal') {
      if (curChar === "'") {
        prevState = curState
        curState = 'single-quote'
        buffer += curChar
      } else if (curChar === '"') {
        prevState = curState
        curState = 'double-quote'
        buffer += curChar
      } else if (curChar === '#') {
        // buffer += request.line.substring(posCur)
        return {buffer, curState, curLinePivot}
      } else if (curChar === '{' && prevChar === '$') {
        prevState = curState
        curState = 'maybe-placeholder'
        posBuffer = posCur - 1
        buffer = buffer.slice(0, -1)
      } else if (curLinePivot === 'key' && curChar === '=') {
        curLinePivot = 'value'
        buffer += curChar
      } else {
        buffer += curChar
      }
    } else if (curState === 'double-quote') {
      if (curChar === '\\') {
        prevState = curState
        curState = 'escaping'
        buffer += curChar
      } else if (curChar === '"') {
        prevState = curState
        curState = 'normal'
        buffer += curChar
      } else if (curChar === '{' && prevChar === '$') {
        prevState = curState
        curState = 'maybe-placeholder'
        posBuffer = posCur - 1
        buffer = buffer.slice(0, -1)
      } else {
        buffer += curChar
      }
    } else if (curState === 'single-quote') {
      if (curChar === '\\') {
        prevState = curState
        curState = 'escaping'
        buffer += curChar
      } else if (curChar === '"') {
        prevState = curState
        curState = 'normal'
        buffer += curChar
      } else {
        buffer += curChar
      }
    } else if (curState === 'maybe-placeholder') {
      if (curChar === '}') {
        const key = request.line.substring(posBuffer + 2, posCur)
        let lookup = resolve(key, request.env, request.logic)
        if (lookup === undefined) {
          request.listener.onMissingPlaceholder(request.parseContext, key)
          lookup = ''
        }
        buffer += lookup
        curState = prevState
      }
    } else if (curState === 'escaping') {
      buffer += curChar
      curState = prevState
    }
  }

  return {buffer, curState, curLinePivot}
}

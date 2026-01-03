import {Context, ParseContext, resolve} from './context'

export type ParseState = 'normal' | 'single-quote' | 'double-quote' | 'maybe-placeholder' | 'escaping'

export type ParseLineRequest = {
  readonly curState: ParseState
  readonly doBuffering: boolean
  readonly parseContext: ParseContext
  readonly env: Context
  readonly line: string
  readonly listener: PlaceholderListener
  readonly logic: Context
}

export type ParseLineResponse = {
  readonly buffer: string
  readonly curState: ParseState
}

export type PlaceholderListener = {
  onMissing: (parseContext: ParseContext, key: string) => void
}

export const WarningPlaceholderListener: PlaceholderListener = {
  onMissing: (parseContext: ParseContext, key: string) => {
    console.warn(
      `Logic contexts have no defined value for key [${key}] found in file [${parseContext.filePath}] at line [${parseContext.line}], col [${parseContext.col}]`,
    )
  },
}

export const ThrowingPlaceholderListener: PlaceholderListener = {
  onMissing: (parseContext: ParseContext, key: string) => {
    throw new Error(
      `Logic contexts have no defined value for key [${key}] found in file [${parseContext.filePath}] at line [${parseContext.line}], col [${parseContext.col}]`,
    )
  },
}

export function parseLine(request: ParseLineRequest): ParseLineResponse {
  if (request.line.length === 0) return {buffer: '', curState: request.curState}
  let {curState, doBuffering} = request
  let prevState: ParseState = request.curState
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
      } else if (curChar === '"') {
        prevState = curState
        curState = 'double-quote'
      } else if (curChar === '#') {
        if (doBuffering) buffer += request.line.substring(posCur)
        return {buffer, curState}
      } else if (curChar === '{' && prevChar === '$') {
        prevState = curState
        curState = 'maybe-placeholder'
        posBuffer = posCur - 1
      } else {
        buffer += curChar
      }
    } else if (curState === 'double-quote') {
      if (curChar === '\\') {
        prevState = curState
        curState = 'escaping'
        if (doBuffering) buffer += curChar
      } else if (curChar === '"') {
        prevState = curState
        curState = 'normal'
        if (doBuffering) buffer += curChar
      } else if (curChar === '{' && prevChar === '$') {
        prevState = curState
        curState = 'maybe-placeholder'
        posBuffer = posCur - 1
      } else {
        if (doBuffering) buffer += curChar
      }
    } else if (curState === 'single-quote') {
      if (curChar === '\\') {
        prevState = curState
        curState = 'escaping'
        if (doBuffering) buffer += curChar
      } else if (curChar === '"') {
        prevState = curState
        curState = 'normal'
        if (doBuffering) buffer += curChar
      } else {
        if (doBuffering) buffer += curChar
      }
    } else if (curState === 'maybe-placeholder') {
      if (curChar === '}') {
        const key = request.line.substring(posBuffer + 2, posCur - (posBuffer + 2))
        let lookup = resolve(key, request.env, request.logic)
        if (lookup === undefined) {
          request.listener.onMissing(request.parseContext, key)
          lookup = ''
        }
        if (doBuffering) buffer += lookup
        request.logic[key] = lookup
        curState = prevState
      }
    } else if (curState === 'escaping') {
      if (doBuffering) buffer += curChar
      curState = prevState
    }
  }

  return {buffer, curState}
}

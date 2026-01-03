import {readdirSync, readFileSync, statSync, writeFileSync} from 'fs'
import {join} from 'path'
import {Context} from './context'
import {ParseState, PlaceholderListener, ThrowingPlaceholderListener, WarningPlaceholderListener, parseLine} from './line-parser'

type MashRequest = {
  readonly dirTarget: string
  readonly dirTop: string
  readonly environmentName: string
  readonly listenerType: 'throw' | 'warn'
}

type ParseFileRequest = {
  readonly filePath: string
  readonly outputPath?: string
  readonly env: Context
  readonly listener: PlaceholderListener
  readonly logic: Context
}

function parseFile(request: ParseFileRequest): void {
  const {env, filePath, listener, logic, outputPath} = request
  const contents = readFileSync(filePath, {encoding: 'utf8'})
  const lines = contents.split('\n')
  let data = ''
  let curState: ParseState = 'normal'
  for (let iLine = 0; iLine < lines.length; ++iLine) {
    const response = parseLine({
      curState,
      doBuffering: !!outputPath,
      env,
      line: lines[iLine],
      listener,
      logic,
      parseContext: {
        col: 1,
        filePath,
        line: iLine + 1,
      },
    })
    curState = response.curState
    if (outputPath) data += response.buffer
  }

  if (outputPath) {
    writeFileSync(outputPath, data, {encoding: 'utf8'})
  }
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
  const listener: PlaceholderListener = request.listenerType === 'throw' ? ThrowingPlaceholderListener : WarningPlaceholderListener

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

export type Context = {[key: string]: string | undefined}

export type ParseContext = {
  readonly filePath: string
  line: number
  col: number
}

export function resolve(key: string, env: Context, logic: Context): string | undefined {
  let lookup = env[key]
  if (lookup !== undefined) return lookup
  return logic[key]
}

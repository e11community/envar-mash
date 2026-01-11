import {existsSync, readFileSync, unlinkSync, writeFileSync} from 'fs'
import {join} from 'path'
import {Context} from './context'
import {main, parseFile} from './main'
import {WarningPlaceholderListener} from './line-parser'

const TEST_DIR = join(__dirname, '..', 'test')
const CLEANUP_ENABLED = process.env.TEST_CLEANUP !== 'false'

function cleanupFile(path: string): void {
  if (CLEANUP_ENABLED && existsSync(path)) {
    unlinkSync(path)
  }
}

describe('parseFile', () => {
  const tempOutputPath = join(TEST_DIR, 'temp-output.env')

  afterEach(() => {
    cleanupFile(tempOutputPath)
  })

  it('parses simple env file and writes output', () => {
    const inputPath = join(TEST_DIR, 'simple', '.env.dev.template')
    const env: Context = {}
    const logic: Context = {}

    parseFile({
      filePath: inputPath,
      outputPath: tempOutputPath,
      env,
      listener: WarningPlaceholderListener,
      logic,
    })

    expect(existsSync(tempOutputPath)).toBe(true)
    const output = readFileSync(tempOutputPath, 'utf8')
    expect(output).toContain('FOO=bar')
    expect(output).toContain('BAZ=qux')
  })

  it('resolves placeholders from env', () => {
    const inputPath = join(TEST_DIR, 'placeholders', '.env.dev.template')
    const env: Context = {}
    const logic: Context = {}

    parseFile({
      filePath: inputPath,
      outputPath: tempOutputPath,
      env,
      listener: WarningPlaceholderListener,
      logic,
    })

    const output = readFileSync(tempOutputPath, 'utf8')
    expect(output).toContain('BASE_URL=https://example.com')
    expect(output).toContain('API_URL=https://example.com/api')
    expect(output).toContain('FULL_URL="https://example.com/v1/endpoint"')
  })

  it('updates logic context without writing file when no outputPath', () => {
    const inputPath = join(TEST_DIR, 'simple', '.env.dev.template')
    const env: Context = {}
    const logic: Context = {}

    parseFile({
      filePath: inputPath,
      env,
      listener: WarningPlaceholderListener,
      logic,
    })

    expect(existsSync(tempOutputPath)).toBe(false)
  })

  it('uses process.env for placeholder resolution', () => {
    const inputPath = join(TEST_DIR, 'placeholders', '.env.dev.template')
    const env: Context = {BASE_URL: 'https://override.com'}
    const logic: Context = {}

    parseFile({
      filePath: inputPath,
      outputPath: tempOutputPath,
      env,
      listener: WarningPlaceholderListener,
      logic,
    })

    const output = readFileSync(tempOutputPath, 'utf8')
    expect(output).toContain('API_URL=https://override.com/api')
  })
})

describe('main', () => {
  const cascadeDir = join(TEST_DIR, 'cascade')
  const functionsDir = join(cascadeDir, 'functions')
  const envDir = join(cascadeDir, 'env')
  const outputPath = join(functionsDir, '.env.dev')

  afterEach(() => {
    cleanupFile(outputPath)
  })

  it('returns 0 when template file does not exist', () => {
    const result = main({
      dirTarget: join(TEST_DIR, 'nonexistent'),
      dirTop: envDir,
      environmentName: 'dev',
      listenerType: 'warn',
    })

    expect(result).toBe(0)
  })

  it('processes cascade of env files in correct order', () => {
    const originalCwd = process.cwd()
    process.chdir(functionsDir)

    try {
      const result = main({
        dirTarget: functionsDir,
        dirTop: envDir,
        environmentName: 'dev',
        listenerType: 'warn',
      })

      expect(result).toBe(0)
      expect(existsSync(outputPath)).toBe(true)

      const output = readFileSync(outputPath, 'utf8')
      // Template values
      expect(output).toContain('SERVICE_NAME=my-service')
      // From .env.dev (environment-specific, overrides .env.ALL-before)
      expect(output).toContain('LOG_LEVEL=debug')
      expect(output).toContain('API_KEY=dev-secret-key')
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('uses ThrowingPlaceholderListener when listenerType is throw', () => {
    const originalCwd = process.cwd()
    process.chdir(functionsDir)

    // Create a template with missing placeholder
    const badTemplatePath = join(functionsDir, '.env.bad.template')
    writeFileSync(badTemplatePath, 'FOO=${TOTALLY_MISSING_VAR}\n')

    try {
      expect(() => {
        main({
          dirTarget: functionsDir,
          dirTop: envDir,
          environmentName: 'bad',
          listenerType: 'throw',
        })
      }).toThrow('TOTALLY_MISSING_VAR')
    } finally {
      process.chdir(originalCwd)
      cleanupFile(badTemplatePath)
      cleanupFile(join(functionsDir, '.env.bad'))
    }
  })

  it('handles missing dirTop gracefully', () => {
    const originalCwd = process.cwd()
    process.chdir(functionsDir)

    try {
      const result = main({
        dirTarget: functionsDir,
        dirTop: join(TEST_DIR, 'nonexistent-env-dir'),
        environmentName: 'dev',
        listenerType: 'warn',
      })

      expect(result).toBe(0)
      expect(existsSync(outputPath)).toBe(true)
    } finally {
      process.chdir(originalCwd)
    }
  })
})

import {existsSync, readFileSync, unlinkSync, writeFileSync} from 'fs'
import {join} from 'path'
import {Context} from './context'
import {main, parseFile} from './main'
import {FileListener} from './line-parser'

const IMPL_DIR = join(__dirname, '..', 'impl')
const CLEANUP_ENABLED = process.env.TEST_CLEANUP !== 'false'

const silentListener: FileListener = {
  onNoKeyPair: jest.fn(),
  onMissingPlaceholder: jest.fn(),
}

function cleanupFile(path: string): void {
  if (CLEANUP_ENABLED && existsSync(path)) {
    unlinkSync(path)
  }
}

describe('parseFile', () => {
  const tempOutputPath = join(IMPL_DIR, 'temp-output.env')

  afterEach(() => {
    cleanupFile(tempOutputPath)
  })

  it('parses simple env file and writes output', () => {
    const inputPath = join(IMPL_DIR, 'simple', '.env.dev.template')
    const env: Context = {}
    const logic: Context = {}

    parseFile({
      filePath: inputPath,
      outputPath: tempOutputPath,
      env,
      listener: silentListener,
      logic,
    })

    expect(existsSync(tempOutputPath)).toBe(true)
    const output = readFileSync(tempOutputPath, 'utf8')
    expect(output).toContain('FOO=bar')
    expect(output).toContain('BAZ=qux')
  })

  it('resolves placeholders from logic built during parsing', () => {
    const inputPath = join(IMPL_DIR, 'placeholders', '.env.dev.template')
    const env: Context = {}
    const logic: Context = {}

    parseFile({
      filePath: inputPath,
      outputPath: tempOutputPath,
      env,
      listener: silentListener,
      logic,
    })

    const output = readFileSync(tempOutputPath, 'utf8')
    expect(output).toContain('BASE_URL=https://example.com')
    expect(output).toContain('API_URL=https://example.com/api')
  })

  it('updates logic context with parsed key=value pairs', () => {
    const inputPath = join(IMPL_DIR, 'simple', '.env.dev.template')
    const env: Context = {}
    const logic: Context = {}

    parseFile({
      filePath: inputPath,
      env,
      listener: silentListener,
      logic,
    })

    expect(logic['FOO']).toBe('bar')
    expect(logic['BAZ']).toBe('qux')
  })

  it('uses env for placeholder resolution with higher precedence', () => {
    const inputPath = join(IMPL_DIR, 'placeholders', '.env.dev.template')
    const env: Context = {BASE_URL: 'https://override.com'}
    const logic: Context = {}

    parseFile({
      filePath: inputPath,
      outputPath: tempOutputPath,
      env,
      listener: silentListener,
      logic,
    })

    const output = readFileSync(tempOutputPath, 'utf8')
    expect(output).toContain('API_URL=https://override.com/api')
  })

  describe('quoted value resolution in logic context', () => {
    it('strips quotes from simple quoted values', () => {
      const inputPath = join(IMPL_DIR, 'quoted', '.env.dev.template')
      const logic: Context = {}

      parseFile({
        filePath: inputPath,
        env: {},
        listener: silentListener,
        logic,
      })

      expect(logic['SIMPLE']).toBe('hello world')
    })

    it('resolves escaped quotes inside quoted values', () => {
      const inputPath = join(IMPL_DIR, 'quoted', '.env.dev.template')
      const logic: Context = {}

      parseFile({
        filePath: inputPath,
        env: {},
        listener: silentListener,
        logic,
      })

      expect(logic['ESCAPED']).toBe('say "hello"')
    })

    it('resolves escaped backslashes', () => {
      const inputPath = join(IMPL_DIR, 'quoted', '.env.dev.template')
      const logic: Context = {}

      parseFile({
        filePath: inputPath,
        env: {},
        listener: silentListener,
        logic,
      })

      expect(logic['BACKSLASH']).toBe('path\\to\\file')
    })

    it('handles mixed escapes', () => {
      const inputPath = join(IMPL_DIR, 'quoted', '.env.dev.template')
      const logic: Context = {}

      parseFile({
        filePath: inputPath,
        env: {},
        listener: silentListener,
        logic,
      })

      expect(logic['MIXED']).toBe('quote " and backslash \\')
    })

    it('leaves unquoted values unchanged', () => {
      const inputPath = join(IMPL_DIR, 'quoted', '.env.dev.template')
      const logic: Context = {}

      parseFile({
        filePath: inputPath,
        env: {},
        listener: silentListener,
        logic,
      })

      expect(logic['UNQUOTED']).toBe('no quotes here')
    })

    it('keeps literal value with leading quote when no closing quote', () => {
      const inputPath = join(IMPL_DIR, 'quoted', '.env.dev.template')
      const logic: Context = {}

      parseFile({
        filePath: inputPath,
        env: {},
        listener: silentListener,
        logic,
      })

      expect(logic['UNCLOSED']).toBe('"no closing quote here')
    })

    it('keeps literal value when only escaped quotes present', () => {
      const inputPath = join(IMPL_DIR, 'quoted', '.env.dev.template')
      const logic: Context = {}

      parseFile({
        filePath: inputPath,
        env: {},
        listener: silentListener,
        logic,
      })

      expect(logic['UNCLOSED_ESCAPED']).toBe('"only escaped \\"quotes\\" here')
    })
  })
})

describe('main', () => {
  describe('cascade SOCKET (has ALL-before, ALL-after, and env-specific)', () => {
    const socket = join(IMPL_DIR, 'cascade')
    const dirTop = join(socket, 'env', 'functions')
    const dirTarget = join(socket, 'functions')
    const outputPath = join(dirTarget, '.env.dev')

    afterEach(() => {
      cleanupFile(outputPath)
    })

    it('returns 0 when template file does not exist', () => {
      const result = main({
        dirTarget: join(IMPL_DIR, 'nonexistent'),
        dirTop,
        environmentName: 'dev',
        listenerType: 'warn',
      })

      expect(result).toBe(0)
    })

    it('processes cascade of env files in correct order', () => {
      const result = main({
        dirTarget,
        dirTop,
        environmentName: 'dev',
        listenerType: 'warn',
      })

      expect(result).toBe(0)
      expect(existsSync(outputPath)).toBe(true)

      const output = readFileSync(outputPath, 'utf8')
      expect(output).toContain('SERVICE_NAME=my-service')
      // From .env.dev (environment-specific, overrides .env.ALL-before)
      expect(output).toContain('LOG_LEVEL=debug')
      expect(output).toContain('API_KEY=dev-secret-key')
    })

    it('uses ThrowingFileListener when listenerType is throw', () => {
      const badTemplatePath = join(dirTarget, '.env.bad.template')
      writeFileSync(badTemplatePath, 'FOO=${TOTALLY_MISSING_VAR}\n')

      try {
        expect(() => {
          main({
            dirTarget,
            dirTop,
            environmentName: 'bad',
            listenerType: 'throw',
          })
        }).toThrow('TOTALLY_MISSING_VAR')
      } finally {
        cleanupFile(badTemplatePath)
        cleanupFile(join(dirTarget, '.env.bad'))
      }
    })

    it('handles missing dirTop gracefully', () => {
      const result = main({
        dirTarget,
        dirTop: join(IMPL_DIR, 'nonexistent-env-dir'),
        environmentName: 'dev',
        listenerType: 'warn',
      })

      expect(result).toBe(0)
      expect(existsSync(outputPath)).toBe(true)
    })
  })

  describe('no-all SOCKET (no ALL-before or ALL-after)', () => {
    const socket = join(IMPL_DIR, 'no-all')
    const dirTop = join(socket, 'env', 'functions')

    describe('service-foo', () => {
      const dirTarget = join(socket, 'microservices', 'service-foo', 'functions')
      const outputPath = join(dirTarget, '.env.qa')

      afterEach(() => {
        cleanupFile(outputPath)
      })

      it('resolves placeholders from env-specific file only', () => {
        const result = main({
          dirTarget,
          dirTop,
          environmentName: 'qa',
          listenerType: 'warn',
        })

        expect(result).toBe(0)
        expect(existsSync(outputPath)).toBe(true)

        const output = readFileSync(outputPath, 'utf8')
        expect(output).toContain('SERVICE_NAME=foo')
        expect(output).toContain('PROJECT_ID=no-all-project')
        expect(output).toContain('DB_CONNECTION=postgres://localhost:5432/qa')
      })
    })

    describe('service-bar', () => {
      const dirTarget = join(socket, 'microservices', 'service-bar', 'functions')
      const outputPath = join(dirTarget, '.env.qa')

      afterEach(() => {
        cleanupFile(outputPath)
      })

      it('resolves placeholders from env-specific file only', () => {
        const result = main({
          dirTarget,
          dirTop,
          environmentName: 'qa',
          listenerType: 'warn',
        })

        expect(result).toBe(0)
        expect(existsSync(outputPath)).toBe(true)

        const output = readFileSync(outputPath, 'utf8')
        expect(output).toContain('SERVICE_NAME=bar')
        expect(output).toContain('PROJECT_ID=no-all-project')
      })
    })
  })

  describe('only-before SOCKET (has ALL-before, no ALL-after)', () => {
    const socket = join(IMPL_DIR, 'only-before')
    const dirTop = join(socket, 'env', 'functions')

    describe('service-foo', () => {
      const dirTarget = join(socket, 'microservices', 'service-foo', 'functions')
      const outputPath = join(dirTarget, '.env.qa')

      afterEach(() => {
        cleanupFile(outputPath)
      })

      it('resolves placeholders from ALL-before and env-specific', () => {
        const result = main({
          dirTarget,
          dirTop,
          environmentName: 'qa',
          listenerType: 'warn',
        })

        expect(result).toBe(0)
        expect(existsSync(outputPath)).toBe(true)

        const output = readFileSync(outputPath, 'utf8')
        expect(output).toContain('SERVICE_NAME=foo')
        // From .env.qa
        expect(output).toContain('PROJECT_HASH=ertyuiop')
        // From .env.ALL-before
        expect(output).toContain('REGION=us-east-1')
        expect(output).toContain('NO_COLOR=true')
      })
    })

    describe('service-bar', () => {
      const dirTarget = join(socket, 'microservices', 'service-bar', 'functions')
      const outputPath = join(dirTarget, '.env.qa')

      afterEach(() => {
        cleanupFile(outputPath)
      })

      it('resolves placeholders from ALL-before and env-specific', () => {
        const result = main({
          dirTarget,
          dirTop,
          environmentName: 'qa',
          listenerType: 'warn',
        })

        expect(result).toBe(0)
        expect(existsSync(outputPath)).toBe(true)

        const output = readFileSync(outputPath, 'utf8')
        expect(output).toContain('SERVICE_NAME=bar')
        // From .env.qa
        expect(output).toContain('DEPLOY_ENV=qa')
        // From .env.ALL-before
        expect(output).toContain('REGION=us-east-1')
      })
    })
  })

  describe('only-after SOCKET (has ALL-after, no ALL-before)', () => {
    const socket = join(IMPL_DIR, 'only-after')
    const dirTop = join(socket, 'env', 'functions')

    describe('service-foo', () => {
      const dirTarget = join(socket, 'microservices', 'service-foo', 'functions')
      const outputPath = join(dirTarget, '.env.prod')

      afterEach(() => {
        cleanupFile(outputPath)
      })

      it('resolves placeholders from ALL-after and env-specific', () => {
        const result = main({
          dirTarget,
          dirTop,
          environmentName: 'prod',
          listenerType: 'warn',
        })

        expect(result).toBe(0)
        expect(existsSync(outputPath)).toBe(true)

        const output = readFileSync(outputPath, 'utf8')
        expect(output).toContain('SERVICE_NAME=foo')
        // From .env.prod
        expect(output).toContain('ENVIRONMENT=production')
        expect(output).toContain('API_ENDPOINT=https://api.example.com')
        // From .env.ALL-after
        expect(output).toContain('TIMEOUT=60')
      })
    })

    describe('service-bar', () => {
      const dirTarget = join(socket, 'microservices', 'service-bar', 'functions')
      const outputPath = join(dirTarget, '.env.prod')

      afterEach(() => {
        cleanupFile(outputPath)
      })

      it('resolves placeholders from ALL-after and env-specific', () => {
        const result = main({
          dirTarget,
          dirTop,
          environmentName: 'prod',
          listenerType: 'warn',
        })

        expect(result).toBe(0)
        expect(existsSync(outputPath)).toBe(true)

        const output = readFileSync(outputPath, 'utf8')
        expect(output).toContain('SERVICE_NAME=bar')
        // From .env.prod
        expect(output).toContain('ENVIRONMENT=production')
        // From .env.ALL-after
        expect(output).toContain('RETRY=3')
      })
    })
  })
})

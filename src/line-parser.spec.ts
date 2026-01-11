import {Context} from './context'
import {
  parseLine,
  ParseLineRequest,
  ParseState,
  PlaceholderListener,
  ThrowingPlaceholderListener,
  WarningPlaceholderListener,
} from './line-parser'

describe('parseLine', () => {
  const defaultParseContext = {filePath: 'test.env', line: 1, col: 1}

  function makeParseLine(
    line: string,
    options: {
      curState?: ParseState
      doBuffering?: boolean
      env?: Context
      logic?: Context
      listener?: PlaceholderListener
    } = {},
  ): ReturnType<typeof parseLine> {
    const logic = options.logic ?? {}
    const request: ParseLineRequest = {
      curState: options.curState ?? 'normal',
      doBuffering: options.doBuffering ?? true,
      env: options.env ?? {},
      line,
      listener: options.listener ?? WarningPlaceholderListener,
      logic,
      parseContext: defaultParseContext,
    }
    return parseLine(request)
  }

  describe('basic parsing', () => {
    it('returns empty buffer for empty line', () => {
      const result = makeParseLine('')
      expect(result.buffer).toBe('')
      expect(result.curState).toBe('normal')
    })

    it('parses simple key=value', () => {
      const result = makeParseLine('FOO=bar')
      expect(result.buffer).toBe('FOO=bar')
      expect(result.curState).toBe('normal')
    })

    it('handles comments by stopping at #', () => {
      const result = makeParseLine('FOO=bar # this is a comment')
      expect(result.buffer).toBe('FOO=bar # this is a comment')
    })
  })

  describe('quoted strings', () => {
    it('handles double-quoted values (strips opening quote)', () => {
      const result = makeParseLine('FOO="bar baz"')
      expect(result.buffer).toBe('FOO=bar baz"')
    })

    it('handles single-quoted values (strips opening quote)', () => {
      const result = makeParseLine("FOO='bar baz'")
      expect(result.buffer).toBe("FOO=bar baz'")
    })

    it('handles escaped characters in double quotes', () => {
      const result = makeParseLine('FOO="bar\\"baz"')
      expect(result.buffer).toBe('FOO=bar\\"baz"')
    })
  })

  describe('placeholder substitution', () => {
    it('substitutes placeholder from env', () => {
      const env: Context = {BAR: 'resolved-value'}
      const result = makeParseLine('FOO=${BAR}', {env})
      expect(result.buffer).toBe('FOO=resolved-value')
    })

    it('substitutes placeholder from logic context', () => {
      const logic: Context = {BAR: 'logic-value'}
      const result = makeParseLine('FOO=${BAR}', {logic})
      expect(result.buffer).toBe('FOO=logic-value')
    })

    it('prefers env over logic for placeholder resolution', () => {
      const env: Context = {BAR: 'env-value'}
      const logic: Context = {BAR: 'logic-value'}
      const result = makeParseLine('FOO=${BAR}', {env, logic})
      expect(result.buffer).toBe('FOO=env-value')
    })

    it('substitutes placeholder inside double quotes (strips opening quote)', () => {
      const env: Context = {BAR: 'value'}
      const result = makeParseLine('FOO="${BAR}"', {env})
      expect(result.buffer).toBe('FOO=value"')
    })

    it('updates logic context with resolved value', () => {
      const env: Context = {BAR: 'resolved'}
      const logic: Context = {}
      makeParseLine('FOO=${BAR}', {env, logic})
      expect(logic['BAR']).toBe('resolved')
    })

    it('handles multiple placeholders on same line', () => {
      const env: Context = {A: 'first', B: 'second'}
      const result = makeParseLine('FOO=${A}-${B}', {env})
      expect(result.buffer).toBe('FOO=first-second')
    })
  })

  describe('missing placeholder handling', () => {
    it('calls listener onMissing when placeholder not found', () => {
      const onMissing = jest.fn()
      const listener: PlaceholderListener = {onMissing}
      makeParseLine('FOO=${MISSING}', {listener})
      expect(onMissing).toHaveBeenCalledWith(defaultParseContext, 'MISSING')
    })

    it('substitutes empty string for missing placeholder', () => {
      const result = makeParseLine('FOO=${MISSING}')
      expect(result.buffer).toBe('FOO=')
    })
  })

  describe('buffering control', () => {
    it('returns empty buffer when doBuffering is false', () => {
      const result = makeParseLine('FOO=bar', {doBuffering: false})
      expect(result.buffer).toBe('')
    })

    it('still updates logic context when doBuffering is false', () => {
      const env: Context = {BAR: 'value'}
      const logic: Context = {}
      makeParseLine('FOO=${BAR}', {doBuffering: false, env, logic})
      expect(logic['BAR']).toBe('value')
    })
  })
})

describe('WarningPlaceholderListener', () => {
  it('logs warning to console.warn', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    WarningPlaceholderListener.onMissing({filePath: 'test.env', line: 5, col: 10}, 'MISSING_KEY')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('MISSING_KEY'),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('test.env'),
    )
    warnSpy.mockRestore()
  })
})

describe('ThrowingPlaceholderListener', () => {
  it('throws error with key and file info', () => {
    expect(() => {
      ThrowingPlaceholderListener.onMissing({filePath: 'test.env', line: 5, col: 10}, 'MISSING_KEY')
    }).toThrow('MISSING_KEY')
  })
})

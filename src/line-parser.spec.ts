import {Context} from './context'
import {
  parseLine,
  ParseLineRequest,
  ParseState,
  LinePivot,
  FileListener,
  ThrowingFileListener,
  WarningFileListener,
} from './line-parser'

describe('parseLine', () => {
  const defaultParseContext = {filePath: 'test.env', line: 1, col: 1}
  const silentListener: FileListener = {
    onNoKeyPair: jest.fn(),
    onMissingPlaceholder: jest.fn(),
  }

  function makeParseLine(
    line: string,
    options: {
      curState?: ParseState
      curLinePivot?: LinePivot
      env?: Context
      logic?: Context
      listener?: FileListener
    } = {},
  ): ReturnType<typeof parseLine> {
    const logic = options.logic ?? {}
    const request: ParseLineRequest = {
      curState: options.curState ?? 'normal',
      curLinePivot: options.curLinePivot,
      env: options.env ?? {},
      line,
      listener: options.listener ?? silentListener,
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
      expect(result.curLinePivot).toBe('key')
    })

    it('parses simple key=value', () => {
      const result = makeParseLine('FOO=bar')
      expect(result.buffer).toBe('FOO=bar')
      expect(result.curState).toBe('normal')
      expect(result.curLinePivot).toBe('value')
    })

    it('handles comments by stopping at #', () => {
      const result = makeParseLine('FOO=bar # this is a comment')
      expect(result.buffer).toBe('FOO=bar # this is a comment')
    })

    it('tracks pivot transition from key to value at =', () => {
      const result = makeParseLine('KEY=value')
      expect(result.curLinePivot).toBe('value')
    })

    it('stays in key pivot if no = found', () => {
      const result = makeParseLine('JUST_A_KEY')
      expect(result.curLinePivot).toBe('key')
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

    it('handles multiple placeholders on same line', () => {
      const env: Context = {A: 'first', B: 'second'}
      const result = makeParseLine('FOO=${A}-${B}', {env})
      expect(result.buffer).toBe('FOO=first-second')
    })
  })

  describe('missing placeholder handling', () => {
    it('calls listener onMissingPlaceholder when placeholder not found', () => {
      const onMissingPlaceholder = jest.fn()
      const listener: FileListener = {onNoKeyPair: jest.fn(), onMissingPlaceholder}
      makeParseLine('FOO=${MISSING}', {listener})
      expect(onMissingPlaceholder).toHaveBeenCalledWith(defaultParseContext, 'MISSING')
    })

    it('substitutes empty string for missing placeholder', () => {
      const result = makeParseLine('FOO=${MISSING}')
      expect(result.buffer).toBe('FOO=')
    })
  })
})

describe('WarningFileListener', () => {
  it('logs warning for missing placeholder', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    WarningFileListener.onMissingPlaceholder({filePath: 'test.env', line: 5, col: 10}, 'MISSING_KEY')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('MISSING_KEY'),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('test.env'),
    )
    warnSpy.mockRestore()
  })

  it('logs warning for no key pair', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    WarningFileListener.onNoKeyPair({filePath: 'test.env', line: 5, col: 1}, 'INVALID_LINE')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('INVALID_LINE'),
    )
    warnSpy.mockRestore()
  })
})

describe('ThrowingFileListener', () => {
  it('throws error for missing placeholder', () => {
    expect(() => {
      ThrowingFileListener.onMissingPlaceholder({filePath: 'test.env', line: 5, col: 10}, 'MISSING_KEY')
    }).toThrow('MISSING_KEY')
  })

  it('throws error for no key pair', () => {
    expect(() => {
      ThrowingFileListener.onNoKeyPair({filePath: 'test.env', line: 5, col: 1}, 'BAD_LINE')
    }).toThrow('BAD_LINE')
  })
})

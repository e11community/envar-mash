import {Context, resolve} from './context'

describe('resolve', () => {
  it('returns value from env when key exists in env', () => {
    const env: Context = {FOO: 'from-env'}
    const logic: Context = {FOO: 'from-logic'}

    expect(resolve('FOO', env, logic)).toBe('from-env')
  })

  it('returns value from logic when key not in env', () => {
    const env: Context = {}
    const logic: Context = {FOO: 'from-logic'}

    expect(resolve('FOO', env, logic)).toBe('from-logic')
  })

  it('returns undefined when key not in env or logic', () => {
    const env: Context = {}
    const logic: Context = {}

    expect(resolve('MISSING', env, logic)).toBeUndefined()
  })

  it('prefers env over logic even when env value is empty string', () => {
    const env: Context = {FOO: ''}
    const logic: Context = {FOO: 'from-logic'}

    expect(resolve('FOO', env, logic)).toBe('')
  })

  it('falls back to logic when env value is undefined', () => {
    const env: Context = {FOO: undefined}
    const logic: Context = {FOO: 'from-logic'}

    expect(resolve('FOO', env, logic)).toBe('from-logic')
  })
})

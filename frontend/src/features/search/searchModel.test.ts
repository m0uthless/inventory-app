import { beforeEach, describe, expect, it } from 'vitest'
import { groupOf, highlightParts, iconOf, pushRecent, readRecent, resultPath } from './searchModel'

describe('searchModel', () => {
  beforeEach(() => { try { localStorage.clear() } catch { /* niente */ } })

  it('groups and icons', () => {
    expect(groupOf('drive_file')).toBe('drive')
    expect(groupOf('customer')).toBe('customer')
    expect(groupOf('boh')).toBeNull()
    expect(iconOf('drive_file')).toBe('file')
    expect(iconOf('drive_folder')).toBe('folder')
  })

  it('resultPath prefers backend path', () => {
    expect(resultPath({ kind: 'site', id: 3, title: 'x', path: '/sites?open=3' })).toBe('/sites?open=3')
    expect(resultPath({ kind: 'contact', id: 4, title: 'x' })).toBe('/contacts?open=4')
    expect(resultPath({ kind: 'drive_file', id: 9, title: 'x' })).toBe('/drive?file=9')
    expect(resultPath({ kind: 'boh', id: 1, title: 'x' })).toBeNull()
  })

  it('highlightParts', () => {
    expect(highlightParts('IRCCS Rizzoli Bologna', 'rizzoli')).toEqual([{ t: 'IRCCS ', hit: false }, { t: 'Rizzoli', hit: true }, { t: ' Bologna', hit: false }])
    expect(highlightParts('a.b (c)', '(c)')).toEqual([{ t: 'a.b ', hit: false }, { t: '(c)', hit: true }])
    expect(highlightParts('testo', '')).toEqual([{ t: 'testo', hit: false }])
  })

  it('recent searches', () => {
    pushRecent('Rizzoli'); pushRecent('RX660'); pushRecent('rizzoli'); pushRecent('x')
    expect(readRecent()).toEqual(['rizzoli', 'RX660'])
  })
})

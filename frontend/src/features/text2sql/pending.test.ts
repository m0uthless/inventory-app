import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addPending, dropPending, hasPending, pendingIds, setPendingIds, settlePending } from './pending'

const notif = (id: number, type = 'text2sql_ready') => ({ notification_type: type, link: `/knowledge/sql?apri=${id}` })

describe('domande in attesa (campanella veloce)', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-20T10:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('si aggiungono e si tolgono le domande', () => {
    addPending(5); addPending(7); addPending(5)
    expect(pendingIds()).toEqual([5, 7])
    dropPending(5)
    expect(pendingIds()).toEqual([7])
    dropPending(7)
    expect(hasPending()).toBe(false)
  })

  it('l\'arrivo della notifica toglie solo la sua domanda', () => {
    setPendingIds([5, 7])
    settlePending([notif(5), notif(70), notif(7, 'area_task_due')])
    expect(pendingIds()).toEqual([7])
  })

  it('senza domande in attesa la campanella torna al ritmo normale', () => {
    setPendingIds([5])
    settlePending([notif(5)])
    expect(hasPending()).toBe(false)
  })

  it('dopo 20 minuti il segnale scade comunque', () => {
    setPendingIds([5])
    vi.advanceTimersByTime(20 * 60 * 1000 + 1)
    expect(hasPending()).toBe(false)
  })

  it('un valore rovinato vale come nessuna attesa', () => {
    localStorage.setItem('t2s_pending', '{rotto')
    expect(pendingIds()).toEqual([])
  })
})

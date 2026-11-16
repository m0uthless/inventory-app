import * as React from 'react'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'

export type IssueWikiLink = {
  id: number
  page: number
  page_title: string
  page_slug: string
  kb_code: string
  page_available: boolean
  steps: { text: string; checked: boolean }[]
}

/**
 * Articoli Wiki collegati a una issue e passi della procedura (spunte salvate sulla issue).
 * Condiviso tra la card «Prossimo passo» in cima alla scheda e la sezione «Procedura».
 * `links` è null finché non è caricato o se l'utente non vede la Wiki.
 */
export function useIssueWiki(issueId: number | null, canViewWiki: boolean) {
  const toast = useToast()
  const [links, setLinks] = React.useState<IssueWikiLink[] | null>(null)

  React.useEffect(() => {
    if (!canViewWiki || issueId == null) { setLinks(null); return }
    let alive = true
    setLinks(null)
    api.get<IssueWikiLink[]>(`/issues/${issueId}/wiki/`)
      .then((r) => { if (alive) setLinks(r.data) })
      .catch(() => { if (alive) setLinks([]) })
    return () => { alive = false }
  }, [issueId, canViewWiki])

  const replace = (l: IssueWikiLink) => setLinks((ls) => (ls ?? []).map((x) => (x.id === l.id ? l : x)))

  const toggle = async (l: IssueWikiLink, text: string, checked: boolean) => {
    replace({ ...l, steps: l.steps.map((s) => (s.text === text ? { ...s, checked } : s)) })
    try {
      const r = await api.patch<IssueWikiLink>(`/issues/${issueId}/wiki/${l.id}/`, { step: text, checked })
      replace(r.data)
    } catch (e) {
      replace(l)
      toast.error(apiErrorToMessage(e))
    }
  }

  const link = async (pageId: number) => {
    try {
      const r = await api.post<IssueWikiLink>(`/issues/${issueId}/wiki/`, { page: pageId })
      setLinks((ls) => [...(ls ?? []).filter((x) => x.id !== r.data.id), r.data])
      toast.success(`Collegato «${r.data.page_title}»`)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  const unlink = async (l: IssueWikiLink) => {
    setLinks((ls) => (ls ?? []).filter((x) => x.id !== l.id))
    try {
      await api.delete(`/issues/${issueId}/wiki/${l.id}/`)
      toast.success(`Scollegato «${l.page_title}»`)
    } catch (e) {
      setLinks((ls) => [...(ls ?? []), l])
      toast.error(apiErrorToMessage(e))
    }
  }

  // Prossimo passo: il primo non spuntato, nell'ordine degli articoli collegati.
  const allSteps = (links ?? []).flatMap((l) => l.steps.map((s) => ({ link: l, step: s })))
  const next = allSteps.find((x) => !x.step.checked) ?? null
  const done = allSteps.filter((x) => x.step.checked).length

  return { links, toggle, link, unlink, next, done, total: allSteps.length }
}

export type IssueWiki = ReturnType<typeof useIssueWiki>

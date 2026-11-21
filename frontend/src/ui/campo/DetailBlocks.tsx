/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { Box, Button, ButtonBase, IconButton, Tooltip, Typography } from '@mui/material'
import { CampoIcon, type CampoIconName } from './CampoIcon'
import { DetailSection } from './FloatingDetail'
import AddressMap from '../AddressMap'

/*
 * Blocchi del pannello di dettaglio "Campo sterile" condivisi tra le anagrafiche
 * (Clienti, Siti, …): riepilogo a numeri, contatti, sede con mappa, azioni dirette.
 */

const mono = { fontFamily: '"Geist Mono", monospace' }
const tel = (p: string) => p.replace(/\s+/g, '')

export const linkBtnSx = { minWidth: 0, p: 0, height: 'auto', fontSize: 12, fontWeight: 550, color: 'primary.main', '&:hover': { bgcolor: 'transparent', textDecoration: 'underline', textUnderlineOffset: '3px' } }
export function LinkButton({ children, onClick, sx }: { children: React.ReactNode; onClick: () => void; sx?: object }) {
  return <Button size="small" sx={{ ...linkBtnSx, ...sx }} onClick={onClick}>{children}</Button>
}

export function CountBadge({ n }: { n: number | null | undefined }) {
  if (n == null) return null
  return <Box component="span" sx={{ ml: 0.5, px: 0.75, borderRadius: '5px', bgcolor: 'archie.neutralBg', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{n}</Box>
}

/** Riepilogo: numeri centrati con separatori; `warn` = colore + orologio (scadenza vicina). */
export function StatRow({ items }: { items: { label: string; value: React.ReactNode; onClick?: () => void; warn?: boolean; tip?: string }[] }) {
  return (
    <Box component="section" aria-label="Riepilogo" sx={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))`, mt: -0.75 }}>
      {items.map((it) => (
        <Tooltip key={it.label} title={it.tip ?? ''} disableHoverListener={!it.tip}>
          <ButtonBase onClick={it.onClick} disabled={!it.onClick} sx={{
            position: 'relative', display: 'grid', justifyItems: 'center', gap: '2px', py: 1, px: 0.5, borderRadius: '8px', minWidth: 0,
            '& + &::before': { content: '""', position: 'absolute', left: 0, top: 14, bottom: 14, width: '1px', bgcolor: 'divider' },
            '&:hover b': { color: it.warn ? 'warning.main' : 'primary.main' }, '&.Mui-disabled': { color: 'inherit' },
          }}>
            <Box component="b" sx={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: 18, fontWeight: 650, letterSpacing: '-0.01em', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: it.warn ? 'warning.main' : 'text.primary', transition: 'color .12s' }}>
              {it.value}{it.warn ? <CampoIcon name="clock" size={15} bold /> : null}
            </Box>
            <Box component="span" sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>{it.label}</Box>
          </ButtonBase>
        </Tooltip>
      ))}
    </Box>
  )
}

/** Azione diretta (telefono / email): icona a tratto spesso + testo, copia al passaggio. */
export function DirectLink({ href, icon, text, monoText, onCopy, copyLabel }: { href: string; icon: 'phone' | 'mail'; text: string; monoText?: boolean; onCopy: () => void; copyLabel: string }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '2px', minWidth: 0, maxWidth: '100%', '&:hover .cp, & .cp:focus-visible': { opacity: 1 } }}>
      <Box component="a" href={href} sx={{
        display: 'inline-flex', alignItems: 'center', gap: '7px', minWidth: 0, color: 'text.primary', textDecoration: 'none', fontSize: 12, fontWeight: 550,
        '& svg': { color: 'primary.main' },
        '&:hover': { color: 'primary.main', '& .tx': { textDecoration: 'underline', textUnderlineOffset: '3px' } },
      }}>
        <CampoIcon name={icon} size={15} bold />
        <Box component="span" className="tx" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(monoText ? mono : {}) }}>{text}</Box>
      </Box>
      <Tooltip title="Copia"><IconButton className="cp" size="small" aria-label={copyLabel} onClick={onCopy} sx={{ width: 24, height: 24, opacity: 0, transition: 'opacity .12s' }}><CampoIcon name="copy" size={13} /></IconButton></Tooltip>
    </Box>
  )
}

/** Stato vuoto tratteggiato con azione (aggiungi …). */
export function EmptyAction({ icon, title, sub, onClick, disabled }: { icon: CampoIconName; title: string; sub: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <ButtonBase onClick={onClick} disabled={disabled || !onClick} sx={{
      display: 'grid', gridTemplateColumns: '32px minmax(0,1fr) 16px', gap: 1.5, alignItems: 'center', width: '100%', textAlign: 'left',
      p: '10px 12px', border: '1px dashed', borderColor: 'archie.borderStrong', borderRadius: '8px', color: 'primary.main',
      '&:hover': { borderColor: 'primary.main', bgcolor: 'archie.field' }, '&.Mui-disabled': { color: 'text.disabled' },
    }}>
      <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'archie.field', display: 'grid', placeItems: 'center' }}><CampoIcon name={icon} size={16} /></Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 13, color: 'text.primary' }}>{title}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{sub}</Typography>
      </Box>
      {onClick && !disabled ? <CampoIcon name="plus" size={16} /> : <span />}
    </ButtonBase>
  )
}

export type PersonRef = { id?: number; name: string; role?: string | null; where?: string | null; phone?: string | null; email?: string | null }

/** Contatti: il primario in evidenza (telefono ed email sulla stessa riga), poi fino a 3 referenti. */
export function ContactsBlock({ primary, others, loaded, onAll, onCopy, emptySub, othersEmptySub }: {
  primary: PersonRef | null
  others: PersonRef[]
  loaded: boolean
  onAll: () => void
  onCopy: (v: string) => void
  emptySub?: string
  othersEmptySub?: string
}) {
  const count = (primary ? 1 : 0) + others.length
  return (
    <DetailSection title={<>Contatti {loaded ? <CountBadge n={count} /> : null}</>} end={<LinkButton onClick={onAll}>Tutti i contatti</LinkButton>}>
      {primary ? (
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Box>
            <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 13, fontWeight: 600 }}>
              {primary.name}
              <Box component="span" sx={{ fontSize: 10, fontWeight: 650, letterSpacing: '.02em', color: 'primary.main', bgcolor: 'archie.field', borderRadius: '4px', px: 0.75, py: '1px' }}>Primario</Box>
            </Typography>
            {primary.role ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{primary.role}</Typography> : null}
          </Box>
          {primary.phone || primary.email ? (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 18px', mt: -0.25 }}>
              {primary.phone ? <DirectLink href={`tel:${tel(primary.phone)}`} icon="phone" text={primary.phone} monoText onCopy={() => onCopy(primary.phone!)} copyLabel="Copia il telefono" /> : null}
              {primary.email ? <DirectLink href={`mailto:${primary.email}`} icon="mail" text={primary.email} onCopy={() => onCopy(primary.email!)} copyLabel="Copia l'email" /> : null}
            </Box>
          ) : null}
        </Box>
      ) : (
        <EmptyAction icon="user" title="Nessun contatto primario" sub={others.length ? (othersEmptySub ?? 'Sceglilo tra i referenti qui sotto, dalla pagina Contatti') : (emptySub ?? 'Aggiungi il referente principale dalla pagina Contatti')} onClick={onAll} />
      )}
      {others.length ? (
        <Box component="ul" aria-label="Altri referenti" sx={{ listStyle: 'none', m: 0, mt: 1.5, p: 0, borderTop: '1px solid', borderColor: 'divider' }}>
          {others.slice(0, 3).map((c, i) => (
            <Box component="li" key={c.id ?? i} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 1.5, minHeight: 46, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>
                  {c.name}{c.role ? <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: 12, ml: 0.75 }}>{c.role}</Box> : null}
                </Typography>
                {c.where ? <Typography noWrap sx={{ fontSize: 11, color: 'text.disabled' }}>{c.where}</Typography> : null}
              </Box>
              {c.phone ? (
                <Box component="a" href={`tel:${tel(c.phone)}`} title={`Chiama ${c.name}`} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, fontWeight: 550, color: 'text.primary', textDecoration: 'none', whiteSpace: 'nowrap', '& svg': { color: 'primary.main' }, '&:hover': { color: 'primary.main' } }}>
                  <CampoIcon name="phone" size={14} bold /><Box component="span" sx={mono}>{c.phone}</Box>
                </Box>
              ) : c.email ? (
                <Box component="a" href={`mailto:${c.email}`} title={`Scrivi a ${c.name}`} sx={{ display: 'inline-flex', color: 'primary.main' }}><CampoIcon name="mail" size={15} bold /></Box>
              ) : <span />}
            </Box>
          ))}
          {others.length > 3 ? <LinkButton sx={{ mt: 0.75 }} onClick={onAll}>Altri {others.length - 3} referenti</LinkButton> : null}
        </Box>
      ) : null}
    </DetailSection>
  )
}

/** Sede: mappa con sopra la barra dell'indirizzo e "Apri in Mappe". */
export function MapBlock({ title = 'Sede', street, place, query }: { title?: string; street: string; place?: string; query: string }) {
  return (
    <DetailSection title={title}>
      <Box sx={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', '& > div:first-of-type': { borderRadius: 0, border: 0 } }}>
        <AddressMap address={query} height={170} zoom={15} />
        <Box sx={{
          position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.25,
          p: '7px 7px 7px 10px', borderRadius: '8px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', boxShadow: '0 6px 16px -8px rgb(0 0 0 / .25)',
        }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 12, fontWeight: 600 }}>{street}</Typography>
            {place ? <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{place}</Typography> : null}
          </Box>
          <Button size="small" variant="outlined" component="a" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`} target="_blank" rel="noopener"
            endIcon={<CampoIcon name="arrowR" size={13} />} sx={{ flex: 'none' }}>Apri in Mappe</Button>
        </Box>
      </Box>
    </DetailSection>
  )
}

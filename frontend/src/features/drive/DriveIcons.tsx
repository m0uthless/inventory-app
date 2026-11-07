import * as React from 'react'
import type { FileKind } from './driveModel'

/*
 * Icone dei file e delle cartelle del Drive, disegnate qui nello stile delle icone
 * di sistema (foglio con angolo piegato, banda colorata, simbolo del tipo).
 * Come le icone del desktop sono "artwork": i colori sono fissi e non seguono il tema.
 * Il tipo è sempre scritto (PDF, DOC…) oltre che colorato, quindi mai solo colore.
 */

const PAGE = (
  <>
    <path d="M5 1.5h16.5l8 8V37a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 37V3A1.5 1.5 0 0 1 5 1.5z" fill="#fff" stroke="#c9d1d8" />
    <path d="M21.5 1.5V8a1.5 1.5 0 0 0 1.5 1.5h6.5" fill="#e9edf1" stroke="#c9d1d8" strokeLinejoin="round" />
  </>
)

function Band({ color, text }: { color: string; text: string }) {
  return (
    <>
      <rect x="1" y="21" width="22" height="11" rx="2" fill={color} />
      <text x="12" y="29.2" textAnchor="middle" fontFamily="Geist, Segoe UI, sans-serif" fontSize={text.length > 3 ? 6 : 7.2} fontWeight={700} fill="#fff" letterSpacing=".2">{text}</text>
    </>
  )
}

const lines = (c: string) => <g stroke={c} strokeWidth="1.4" strokeLinecap="round"><path d="M8 12h13M8 16h15" /></g>

function Glyph({ kind, ext, clipId }: { kind: FileKind; ext: string; clipId: string }) {
  switch (kind) {
    case 'pdf': return <>{lines('#e2c2bf')}<Band color="#d93a2e" text="PDF" /></>
    case 'doc': return <>{lines('#bcd0ef')}<path d="M8 20h15" stroke="#bcd0ef" strokeWidth="1.4" strokeLinecap="round" /><Band color="#2563c9" text="DOC" /></>
    case 'xls': return <><g fill="none" stroke="#a9d3b8" strokeWidth="1.1"><rect x="8" y="11" width="16" height="11" /><path d="M8 14.7h16M8 18.4h16M13.3 11v11M18.6 11v11" /></g><Band color="#16824a" text="XLS" /></>
    case 'ppt': return <><rect x="8" y="10" width="16" height="10" rx="1" fill="#f6d2c4" /><path d="M11 17l3-3 2 2 3-4" stroke="#d2572b" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" /><Band color="#c8471f" text="PPT" /></>
    case 'zip': return <><path d="M16 2v26" stroke="#e7a53a" strokeWidth="3" strokeDasharray="2 2" /><rect x="13" y="26" width="6" height="8" rx="1.5" fill="#d9921f" /><rect x="14.6" y="28.5" width="2.8" height="3" rx=".6" fill="#fff" /></>
    case 'txt': return <g stroke="#b9c3cc" strokeWidth="1.4" strokeLinecap="round"><path d="M8 13h15M8 17h15M8 21h12M8 25h15M8 29h9" /></g>
    case 'mail': return <><rect x="7" y="13" width="18" height="13" rx="1.5" fill="#e5eefb" stroke="#5b8bd6" /><path d="M7.5 14l8.5 6.5L24.5 14" fill="none" stroke="#5b8bd6" strokeWidth="1.3" strokeLinejoin="round" /></>
    case 'img': return (
      <>
        <clipPath id={clipId}><rect x="6" y="12" width="20" height="20" rx="2" /></clipPath>
        <g clipPath={`url(#${clipId})`}>
          <rect x="6" y="12" width="20" height="20" fill="#7cc6f2" /><circle cx="21" cy="17" r="2.6" fill="#ffd34d" />
          <path d="M6 32l7-10 5 6 3-3 5 7z" fill="#2f9a5b" /><path d="M6 32l7-10 4 5-5 5z" fill="#3fb36d" />
        </g>
      </>
    )
    default: return ext ? <Band color="#6b7b86" text={ext.slice(0, 4).toUpperCase()} /> : lines('#b9c3cc')
  }
}

export function FileIcon({ kind, ext = '', size = 28, className }: { kind: FileKind; ext?: string; size?: number; className?: string }) {
  const clipId = React.useId().replace(/:/g, '')
  return (
    <svg className={`d-ficon${className ? ` ${className}` : ''}`} width={Math.round(size * 0.8)} height={size} viewBox="0 0 32 40" aria-hidden focusable="false">
      {PAGE}<Glyph kind={kind} ext={ext} clipId={`ci${clipId}`} />
    </svg>
  )
}

/** Cartella gialla; segno sovrapposto per le cartelle dei clienti o riservate ad alcuni gruppi. */
export function FolderIcon({ size = 22, badge }: { size?: number; badge?: 'customer' | 'lock' | null }) {
  return (
    <svg className="d-folder" width={Math.round(size * 1.25)} height={size} viewBox="0 0 40 32" aria-hidden focusable="false">
      <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h10.2l3 3h17.8A2.5 2.5 0 0 1 38 9.5V12H2z" fill="#e0a21b" />
      <rect x="2" y="9" width="36" height="21" rx="2.5" fill="#fbc531" />
      <path d="M2 11.5A2.5 2.5 0 0 1 4.5 9h31A2.5 2.5 0 0 1 38 11.5v1H2z" fill="#ffd866" />
      {badge === 'lock' ? (
        <>
          <circle cx="32" cy="25" r="7" fill="#fff" stroke="#c9d1d8" />
          <rect x="29" y="24" width="6" height="5" rx="1" fill="#5b6b67" />
          <path d="M30.2 24v-1.5a1.8 1.8 0 0 1 3.6 0V24" fill="none" stroke="#5b6b67" strokeWidth="1.2" />
        </>
      ) : badge === 'customer' ? (
        <>
          <circle cx="32" cy="25" r="7" fill="#fff" stroke="#c9d1d8" />
          <rect x="28.6" y="20.8" width="6.8" height="8.4" rx=".8" fill="#1f6b5c" />
          <g fill="#fff"><rect x="29.9" y="22.2" width="1.5" height="1.5" /><rect x="32.6" y="22.2" width="1.5" height="1.5" /><rect x="29.9" y="24.8" width="1.5" height="1.5" /><rect x="32.6" y="24.8" width="1.5" height="1.5" /><rect x="31.2" y="27.3" width="1.6" height="1.9" /></g>
        </>
      ) : null}
    </svg>
  )
}

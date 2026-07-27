import * as React from 'react'
import { Box, Typography } from '@mui/material'

/**
 * Renderer Markdown "lite" pensato per testi brevi (voci di changelog):
 * titoli (#, ##, ###), grassetto (**testo**), corsivo (*testo* oppure _testo_),
 * code inline (`testo`), elenchi puntati (- / *) e numerati (1.), paragrafi.
 *
 * Deliberatamente NON usa dangerouslySetInnerHTML: ogni blocco viene
 * trasformato in nodi React veri, quindi non c'è alcun rischio di
 * injection anche se il testo contiene markup arbitrario. Non è un parser
 * CommonMark completo: copre solo la sintassi utile per note di rilascio.
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Ordine: code inline, poi bold, poi italic. Split sequenziale non-ricorsivo,
  // sufficiente per testo di changelog (niente markup annidato complesso).
  const nodes: React.ReactNode[] = []
  const tokenRe = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    if (match[1] !== undefined) {
      nodes.push(
        <Box
          key={`${keyPrefix}-${i++}`}
          component="code"
          sx={{
            fontFamily: 'monospace', fontSize: '0.85em', bgcolor: 'action.hover',
            px: 0.6, py: 0.1, borderRadius: 0.5,
          }}
        >
          {match[1]}
        </Box>,
      )
    } else if (match[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${i++}`}>{match[2]}</strong>)
    } else {
      const italicText = match[3] ?? match[4]
      nodes.push(<em key={`${keyPrefix}-${i++}`}>{italicText}</em>)
    }
    lastIndex = tokenRe.lastIndex
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes.length > 0 ? nodes : [text]
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; lines: string[] }

function parseBlocks(source: string): Block[] {
  const rawLines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < rawLines.length) {
    const line = rawLines[i]

    if (line.trim() === '') {
      i++
      continue
    }

    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length as 1 | 2 | 3, text: headingMatch[2].trim() })
      i++
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < rawLines.length && /^\s*[-*]\s+/.test(rawLines[i])) {
        items.push(rawLines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < rawLines.length && /^\s*\d+[.)]\s+/.test(rawLines[i])) {
        items.push(rawLines[i].replace(/^\s*\d+[.)]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    const lines: string[] = []
    while (i < rawLines.length && rawLines[i].trim() !== '' && !/^(#{1,3})\s+/.test(rawLines[i]) && !/^\s*[-*]\s+/.test(rawLines[i]) && !/^\s*\d+[.)]\s+/.test(rawLines[i])) {
      lines.push(rawLines[i])
      i++
    }
    blocks.push({ type: 'p', lines })
  }

  return blocks
}

const HEADING_SX: Record<1 | 2 | 3, object> = {
  1: { fontSize: '1.05rem', fontWeight: 700, mt: 1.5, mb: 0.5 },
  2: { fontSize: '0.95rem', fontWeight: 700, mt: 1.25, mb: 0.5 },
  3: { fontSize: '0.88rem', fontWeight: 700, mt: 1, mb: 0.5 },
}

export default function MarkdownLite({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseBlocks(text || ''), [text])

  return (
    <Box sx={{ '& > *:first-of-type': { mt: 0 } }}>
      {blocks.map((block, bi) => {
        const key = `b${bi}`
        if (block.type === 'heading') {
          return (
            <Typography key={key} sx={HEADING_SX[block.level]}>
              {renderInline(block.text, key)}
            </Typography>
          )
        }
        if (block.type === 'ul') {
          return (
            <Box key={key} component="ul" sx={{ m: 0, my: 0.5, pl: 2.5 }}>
              {block.items.map((item, ii) => (
                <Typography key={ii} component="li" sx={{ fontSize: '0.85rem', mb: 0.25 }}>
                  {renderInline(item, `${key}-${ii}`)}
                </Typography>
              ))}
            </Box>
          )
        }
        if (block.type === 'ol') {
          return (
            <Box key={key} component="ol" sx={{ m: 0, my: 0.5, pl: 2.5 }}>
              {block.items.map((item, ii) => (
                <Typography key={ii} component="li" sx={{ fontSize: '0.85rem', mb: 0.25 }}>
                  {renderInline(item, `${key}-${ii}`)}
                </Typography>
              ))}
            </Box>
          )
        }
        return (
          <Typography key={key} sx={{ fontSize: '0.85rem', mb: 0.75, whiteSpace: 'pre-line' }}>
            {block.lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(line, `${key}-${li}`)}
              </React.Fragment>
            ))}
          </Typography>
        )
      })}
    </Box>
  )
}

export type SqlSegment = { text: string; kind: 'keyword' | 'comment' | 'string' | 'plain' }

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'ORDER', 'BY', 'HAVING',
  'COUNT', 'DISTINCT', 'SUM', 'AVG', 'MIN', 'MAX', 'AS', 'IN', 'EXISTS', 'DELETE', 'UPDATE', 'SET', 'INSERT', 'INTO', 'VALUES',
  'FETCH', 'FIRST', 'ROWS', 'ONLY', 'TRUNC', 'SYSDATE', 'LIKE', 'UPPER', 'LOWER', 'NULL', 'IS', 'BETWEEN', 'DATE', 'DESC', 'ASC',
  'ROUND', 'WITH', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'ALL', 'ROWNUM', 'TO_CHAR', 'ADD_MONTHS', 'COMMIT', 'MERGE',
])

/** Divide la query in righe e segmenti (parole chiave, commenti `--`, stringhe '…'). */
export function highlightSql(sql: string): SqlSegment[][] {
  return sql.split('\n').map((line) => {
    const out: SqlSegment[] = []
    const push = (text: string, kind: SqlSegment['kind']) => { if (!text) return; const last = out[out.length - 1]; if (last && last.kind === kind && kind === 'plain') last.text += text; else out.push({ text, kind }) }
    let i = 0
    while (i < line.length) {
      if (line.startsWith('--', i)) { push(line.slice(i), 'comment'); break }
      if (line[i] === "'") {
        const end = line.indexOf("'", i + 1)
        const stop = end === -1 ? line.length : end + 1
        push(line.slice(i, stop), 'string'); i = stop; continue
      }
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(i))
      if (m) { push(m[0], KEYWORDS.has(m[0].toUpperCase()) ? 'keyword' : 'plain'); i += m[0].length; continue }
      push(line[i], 'plain'); i += 1
    }
    return out
  })
}

/**
 * Very small markdown → HTML renderer for scenario debrief bodies.
 *
 * Supports: H1/H2/H3, paragraphs, ordered + unordered lists, bold (`**`),
 * italic (`*`), inline code (`` ` ``), and blank-line paragraph breaks.
 * Used only on author-controlled scenario bodies so we don't need a full
 * markdown library (saves ~50 kB gzip).
 *
 * Output is escaped, then formatted: untrusted input would only contain
 * HTML-encoded characters in the final string.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inline(s: string): string {
  return escapeHtml(s)
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // italic
    .replace(/(^|[\s(])\*(.+?)\*/g, '$1<em>$2</em>')
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

interface Block {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol'
  lines: string[]
}

export function renderDebriefMarkdown(source: string): string {
  const blocks: Block[] = []
  const lines = source.split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
      continue
    }
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', lines: [line.slice(4)] })
      i++
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', lines: [line.slice(3)] })
      i++
    } else if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', lines: [line.slice(2)] })
      i++
    } else if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', lines: items })
    } else if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', lines: items })
    } else {
      const para: string[] = []
      while (i < lines.length && lines[i].trim() !== '' &&
             !lines[i].startsWith('#') && !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i])) {
        para.push(lines[i])
        i++
      }
      blocks.push({ type: 'p', lines: para })
    }
  }

  return blocks.map(b => {
    switch (b.type) {
      case 'h1': return `<h1>${inline(b.lines[0])}</h1>`
      case 'h2': return `<h2>${inline(b.lines[0])}</h2>`
      case 'h3': return `<h3>${inline(b.lines[0])}</h3>`
      case 'p':  return `<p>${b.lines.map(inline).join(' ')}</p>`
      case 'ul': return `<ul>${b.lines.map(l => `<li>${inline(l)}</li>`).join('')}</ul>`
      case 'ol': return `<ol>${b.lines.map(l => `<li>${inline(l)}</li>`).join('')}</ol>`
    }
  }).join('\n')
}

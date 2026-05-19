import { describe, it, expect } from 'vitest'
import { renderDebriefMarkdown } from './markdown'

describe('renderDebriefMarkdown', () => {
  it('handles headings', () => {
    expect(renderDebriefMarkdown('# H1\n\n## H2\n\n### H3')).toBe(
      '<h1>H1</h1>\n<h2>H2</h2>\n<h3>H3</h3>',
    )
  })

  it('joins multiline paragraphs', () => {
    expect(renderDebriefMarkdown('one\ntwo\n\nthree')).toBe(
      '<p>one two</p>\n<p>three</p>',
    )
  })

  it('renders unordered list', () => {
    expect(renderDebriefMarkdown('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>')
  })

  it('renders ordered list', () => {
    expect(renderDebriefMarkdown('1. first\n2. second')).toBe(
      '<ol><li>first</li><li>second</li></ol>',
    )
  })

  it('handles bold, italic, inline code', () => {
    const out = renderDebriefMarkdown('**bold** and *italic* and `code`')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('<em>italic</em>')
    expect(out).toContain('<code>code</code>')
  })

  it('escapes HTML in input', () => {
    expect(renderDebriefMarkdown('<script>alert(1)</script>')).toContain('&lt;script&gt;')
  })

  it('renders the real anaphylaxis debrief without crashing', () => {
    const out = renderDebriefMarkdown(
      '# Anaphylaxis — debrief\n\n## Recognition\n\n- Sudden hypotension\n- Tachycardia\n\n## Management\n\n1. **Stop the trigger**\n2. **100% O2**'
    )
    expect(out).toContain('<h1>')
    expect(out).toContain('<ul>')
    expect(out).toContain('<ol>')
    expect(out).toContain('<strong>')
  })
})

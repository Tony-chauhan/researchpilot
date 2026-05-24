/**
 * markdown.js — Lightweight markdown-to-HTML renderer
 * Supports headers, bold, italic, lists, code blocks, tables, links, blockquotes, hr
 */

const MarkdownRenderer = {
  /**
   * Convert markdown string to HTML
   * @param {string} md - Markdown text
   * @returns {string} HTML string
   */
  render(md) {
    if (!md) return '';

    let html = md;

    // Normalize line endings
    html = html.replace(/\r\n/g, '\n');

    // Code blocks (must be first to avoid inner parsing)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const escaped = this.escapeHtml(code.trim());
      return `<pre><code class="language-${lang || 'text'}">${escaped}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Tables
    html = this.renderTables(html);

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    // Merge adjacent blockquotes
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

    // Headers (h1 - h6)
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Horizontal rule
    html = html.replace(/^---+$/gm, '<hr>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Unordered lists
    html = this.renderLists(html);

    // Ordered lists
    html = this.renderOrderedLists(html);

    // Paragraphs (lines not already in a tag)
    html = html.split('\n\n').map(block => {
      block = block.trim();
      if (!block) return '';
      // Don't wrap if already wrapped in a block element
      if (/^<(h[1-6]|ul|ol|li|pre|blockquote|table|hr|div|p)/.test(block)) {
        return block;
      }
      // Wrap remaining text in paragraphs
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return html;
  },

  /**
   * Render markdown tables to HTML
   */
  renderTables(md) {
    const tableRegex = /(?:^|\n)((?:\|.+\|\n)+)/g;

    return md.replace(tableRegex, (match, tableBlock) => {
      const rows = tableBlock.trim().split('\n').filter(r => r.trim());

      if (rows.length < 2) return match;

      // Check if second row is separator
      const isSeparator = /^\|[\s\-:|]+\|$/.test(rows[1].trim());

      if (!isSeparator) return match;

      const parseRow = (row) => {
        return row.split('|').slice(1, -1).map(cell => cell.trim());
      };

      const headers = parseRow(rows[0]);
      const dataRows = rows.slice(2).map(parseRow);

      let table = '<table><thead><tr>';
      headers.forEach(h => { table += `<th>${h}</th>`; });
      table += '</tr></thead><tbody>';

      dataRows.forEach(row => {
        table += '<tr>';
        row.forEach(cell => { table += `<td>${cell}</td>`; });
        table += '</tr>';
      });

      table += '</tbody></table>';
      return '\n' + table + '\n';
    });
  },

  /**
   * Render unordered lists
   */
  renderLists(html) {
    const lines = html.split('\n');
    const result = [];
    let inList = false;

    for (const line of lines) {
      const match = line.match(/^(\s*)[-*]\s+(.+)/);
      if (match) {
        if (!inList) {
          result.push('<ul>');
          inList = true;
        }
        result.push(`<li>${match[2]}</li>`);
      } else {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        result.push(line);
      }
    }

    if (inList) result.push('</ul>');

    return result.join('\n');
  },

  /**
   * Render ordered lists
   */
  renderOrderedLists(html) {
    const lines = html.split('\n');
    const result = [];
    let inList = false;

    for (const line of lines) {
      const match = line.match(/^\s*\d+\.\s+(.+)/);
      if (match) {
        if (!inList) {
          result.push('<ol>');
          inList = true;
        }
        result.push(`<li>${match[1]}</li>`);
      } else {
        if (inList) {
          result.push('</ol>');
          inList = false;
        }
        result.push(line);
      }
    }

    if (inList) result.push('</ol>');

    return result.join('\n');
  },

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, c => map[c]);
  }
};

// Make globally available
window.MarkdownRenderer = MarkdownRenderer;

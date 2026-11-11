// Relocate a leading AI-assistance disclosure so it is not the lede.
// The Markdown files stay as written; only the rendered HTML moves.
export function moveAiNote(html = '') {
  const match = String(html).match(/^\s*<p\b[^>]*>[\s\S]*?<\/p>/i);
  if (!match || !/drafted with AI assistance/i.test(match[0])) return html;
  const note = match[0].replace(/<p\b([^>]*)>/i, (_full, attrs) => {
    if (/\bclass=/.test(attrs)) return `<p${attrs.replace(/class=(["'])/i, 'class=$1ai-note ')}>`;
    return `<p class="ai-note"${attrs}>`;
  });
  const rest = html.slice(match[0].length);
  const sourcesAt = rest.search(/<h2\b[^>]*>\s*Sources\b/i);
  if (sourcesAt >= 0) return `${rest.slice(0, sourcesAt)}${note}${rest.slice(sourcesAt)}`;
  return `${rest}${note}`;
}

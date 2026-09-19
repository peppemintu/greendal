const URL_RE = /https?:\/\/[^\s<>"']+/g;

/**
 * Renders a comment's plain-text body safely: everything goes through JSX
 * text nodes (React escapes those on its own), never dangerouslySetInnerHTML
 * or an HTML string built from user input. URLs are the one thing turned
 * into markup, and only as <a> elements built from the matched substring —
 * there's no path from this text to raw HTML at any point.
 */
export function CommentBody({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_RE.exec(text)) !== null) {
    const rawUrl = match[0];
    const trailingMatch = rawUrl.match(/[.,;:!?)\]]+$/);
    const trailingPunct = trailingMatch ? trailingMatch[0] : '';
    const cleanUrl = trailingPunct ? rawUrl.slice(0, -trailingPunct.length) : rawUrl;

    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a key={key++} href={cleanUrl} target="_blank" rel="nofollow ugc noopener">
        {cleanUrl}
      </a>,
    );
    if (trailingPunct) parts.push(trailingPunct);

    lastIndex = match.index + rawUrl.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{parts}</p>;
}

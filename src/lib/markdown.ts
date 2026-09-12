import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

/**
 * The only author is the authenticated owner, so raw HTML in a post body is
 * allowed on purpose (embeds, figures). If you ever add a second writer you
 * do not fully trust, run this through a sanitiser first.
 */
export function renderMarkdown(md: string): string {
  return marked.parse(md ?? '', { async: false }) as string;
}

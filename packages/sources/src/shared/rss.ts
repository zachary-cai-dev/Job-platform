/** One `<item>` from an RSS 2.0 feed, with lazy tag lookup. */
export interface RssItem {
  /**
   * Text content of the first matching top-level tag (namespaced tags like
   * `job:location` are matched by their full name). Unwraps a `<![CDATA[...]]>`
   * wrapper if present, then XML-entity-decodes the result — this handles both
   * feeds that put raw HTML inside CDATA and feeds that double-encode HTML as
   * entities directly in the tag body. Returns undefined if the tag is absent.
   */
  get(tag: string): string | undefined;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function unwrapCdata(text: string): string {
  const match = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/.exec(text);
  return match?.[1] ?? text;
}

function escapeForRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Splits an RSS 2.0 XML document into its `<item>` elements for tag-by-tag extraction. */
export function parseRssItems(xml: string): RssItem[] {
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return itemMatches.map((raw) => ({
    get(tag: string): string | undefined {
      const pattern = new RegExp(`<${escapeForRegex(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapeForRegex(tag)}>`);
      const match = pattern.exec(raw);
      if (!match?.[1]) return undefined;
      const value = decodeXmlEntities(unwrapCdata(match[1])).trim();
      return value.length > 0 ? value : undefined;
    },
  }));
}

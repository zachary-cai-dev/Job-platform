import DOMPurify from "isomorphic-dompurify";

/**
 * `Job.description` originates from source ATS APIs (Greenhouse/Lever/Ashby content
 * fields), not directly from end users — but it's still third-party content we
 * don't control, rendered via `dangerouslySetInnerHTML`. Sanitize before render
 * rather than trust it, same as any other untrusted-origin HTML.
 */
export function sanitizeJobDescription(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "ul",
      "ol",
      "li",
      "a",
      "h1",
      "h2",
      "h3",
      "h4",
      "blockquote",
      "hr",
      "span",
      "div",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

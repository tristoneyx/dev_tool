/**
 * HTML input attributes that disable browser/OS "smart" text features.
 *
 * macOS WebView (Tauri's underlying WKWebView) auto-converts straight
 * quotes (`"` / `'`) to typographic curly quotes (`”` / `’`) after a
 * letter, capitalizes sentence starts, autocorrects words, and underlines
 * spell-check misses. None of those are appropriate when the user is
 * typing code, URLs, JSON, base64, query params, etc.
 *
 * Spread this object onto any developer-facing `<input>` or `<textarea>`:
 *
 *     <input value={x} onChange={...} {...noSmartTyping} ... />
 */
export const noSmartTyping = {
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
} as const;

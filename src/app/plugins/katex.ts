type KatexModule = typeof import('katex');

let katexModule: KatexModule | undefined;
let loading: Promise<void> | undefined;

/**
 * Loads KaTeX and its stylesheet on first use.
 *
 * Deliberately dynamic. Imported statically, KaTeX puts ~98 kB gzipped of
 * JavaScript plus 47 font files into the main bundle — paid for by every user
 * on every load, for a setting that ships off. Loaded this way it costs nothing
 * until somebody turns maths rendering on.
 */
export const loadKatex = async (): Promise<void> => {
  if (katexModule) return;
  if (!loading) {
    loading = (async () => {
      const [module] = await Promise.all([import('katex'), import('katex/dist/katex.min.css')]);
      katexModule = module;
    })();
  }
  await loading;
};

/**
 * Renders a LaTeX string to HTML, or returns undefined if KaTeX has not
 * finished loading — callers show the sender's plain-text fallback until then.
 *
 * `trust: false` and `strict: 'ignore'` are load-bearing, not defaults worth
 * changing: message content is attacker-controlled, and KaTeX's trusted mode
 * enables commands like \htmlData and \url that inject raw markup and links
 * into the output. Errors render as the offending source rather than throwing,
 * so one malformed formula cannot blank a whole message.
 */
export const renderMaths = (source: string, displayMode: boolean): string | undefined => {
  if (!katexModule) return undefined;
  try {
    return katexModule.default.renderToString(source, {
      displayMode,
      throwOnError: false,
      trust: false,
      strict: 'ignore',
      maxSize: 100,
      // Unbounded macro expansion is a denial-of-service knob — a short message
      // can otherwise pin the render thread.
      maxExpand: 1000,
      output: 'htmlAndMathml',
    });
  } catch {
    return undefined;
  }
};

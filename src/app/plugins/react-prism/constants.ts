/**
 * Longest code block we will syntax-highlight, in characters.
 *
 * `Prism.highlightElement` runs synchronously on the main thread and Prism's
 * tokenizer is quadratic in input length. Both the grammar (`language-*` class)
 * and the text come from the message sender, so an unbounded block is a remote
 * freeze. Measured against this exact grammar set (287 languages, node 22,
 * `Prism.highlight` on adversarial input) — worst grammar at each length:
 *
 *   |   chars | worst grammar | worst time | `javascript` on a run of letters |
 *   |--------:|---------------|-----------:|---------------------------------:|
 *   |   2 000 | scss / nevod  |      35 ms |                            17 ms |
 *   |   4 096 | nevod         |     131 ms |                           ~30 ms |
 *   |   8 000 | scss          |     552 ms |                           250 ms |
 *   |  32 000 | scss          |    8 580 ms|                         4 124 ms |
 *   | 100 000 | scss          |   84 552 ms|                        40 189 ms |
 *
 * `javascript` needs nothing exotic to reach those numbers — a plain run of
 * letters does it — so the cap also stops an honest large paste from freezing
 * the client.
 *
 * 4096 keeps the worst case to roughly 130 ms of jank while covering ordinary
 * code blocks. Longer blocks still render in full, just without colours.
 *
 * Lives in its own module so the parser can consult it without statically
 * importing `ReactPrism`, which would pull all 287 grammars out of their lazy
 * chunk and into the main bundle.
 */
export const MAX_HIGHLIGHT_LENGTH = 4096;

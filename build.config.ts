// `base` is Vite's public base path — the prefix every emitted asset URL gets.
//
// Default '/' suits a deployment at a domain root, which is what self-hosters
// get from the `webapp-release` branch. prinny.app serves the same app from a
// subdirectory (https://prinny.app/app/), and an absolute '/assets/...' URL
// would 404 there, so that build sets PRINNY_BASE=/app/.
//
// Must keep the trailing slash: Vite concatenates rather than joins.
const base = process.env.PRINNY_BASE || '/';

export default {
  base: base.endsWith('/') ? base : `${base}/`,
};

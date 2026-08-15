// Re-exports everything from folds but overrides the `Icons` enum with
// lucide-react icons (see ./icons). Wired via the bare-`folds` alias in
// vite.config.js and the matching `paths` entry in tsconfig.json, so every
// `import {...} from 'folds'` resolves here while subpaths like
// 'folds/dist/style.css' still resolve to the real package.
//
// The two exports below both carry the name `Icons`, which import/export reads
// as a conflict. It is not: an explicit export always shadows a name coming
// from `export *` (a star-exported name that clashes with a local export is
// excluded from the star, per the module spec), so `Icons` resolves to ours and
// everything else to folds'. That shadowing IS the mechanism here.
/* eslint-disable import/export */
export * from 'folds/dist/index.js';
export { Icons } from './icons';

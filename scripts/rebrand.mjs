/**
 * Pre-build: rename Cinny → Prinny across the cinny tree.
 *
 * Used by .github/workflows/publish-webapp.yml so the standalone webapp
 * build carries the same Prinny branding the prinny-client desktop build
 * gets via its `rename-prinny.mjs` beforeBuildCommand.
 *
 * Scope: this script walks only the cinny tree and handles user-facing
 * strings. The desktop counterpart in prinny-client/scripts/rename-prinny.mjs
 * also handles Android package dirs and Tauri config — none of that
 * applies here.
 *
 * Revert:  git checkout -- .
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_PATH = fileURLToPath(import.meta.url);

const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs',
  '.html', '.css', '.svg', '.xml',
  '.json', '.json5',
  '.md',
]);

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build',
  'scripts', // don't self-rename
]);

const SKIP_FILES = new Set([
  'accountData.ts', // Matrix protocol constant — leave alone
  'About.tsx',      // Credit upstream Cinny, not Prinny
]);

function replaceInFile(filePath) {
  if (filePath === SCRIPT_PATH) return false;
  try {
    let content = readFileSync(filePath, 'utf8');
    const original = content;
    // Case-sensitive title-case and all-caps only. Lowercase "cinny" is
    // left untouched on purpose so paths, package names, and SEO keywords
    // referencing upstream stay intact.
    content = content.replace(/\bCinny\b/g, 'Prinny');
    content = content.replace(/\bCINNY\b/g, 'PRINNY');
    if (content !== original) {
      writeFileSync(filePath, content, 'utf8');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function walk(dir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.gitmodules') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      count += walk(path);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;
      if (TEXT_EXTS.has(extname(entry.name).toLowerCase())) {
        if (replaceInFile(path)) {
          console.log(`  ${relative(ROOT, path)}`);
          count++;
        }
      }
    }
  }
  return count;
}

console.log('[rebrand] Renaming Cinny → Prinny (cinny tree)...');
const changed = walk(ROOT);
console.log(`[rebrand] Done — ${changed} files changed.`);

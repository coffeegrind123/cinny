#!/usr/bin/env node
/**
 * Fails the build when a component calls a hook that reads a React context the
 * same component MOUNTS.
 *
 * This is the shape of the "Server versions are not provided!" startup crash:
 * `ClientRoot` renders `<SpecVersions>` (which mounts `SpecVersionsProvider`)
 * and also called `useNotificationAvatarCache` in its own body — and a hook in
 * a component's body runs BEFORE, and outside, the tree that component
 * returns. So the read found no provider, `useSpecVersions` threw, and the
 * router's error boundary replaced the entire app with an error page on every
 * launch.
 *
 * Nothing catches that today: it type-checks, it lints, and the call sits three
 * hops away from the context read (`useNotificationAvatarCache` →
 * `useMediaAuthentication` → `useSpecVersions`), so it does not look like a
 * context read at the call site at all. It is only visible at runtime, and only
 * as a total crash.
 *
 * The analysis, deliberately coarse and conservative:
 *
 *   1. Find context modules — a `createContext` plus an exported `*Provider`
 *      and the hooks that call `useContext` on it.
 *   2. READERS = the transitive closure of functions that call those hooks.
 *   3. MOUNTERS = components whose JSX contains the provider, plus the
 *      transitive closure of components that render THOSE (mounting via a
 *      wrapper, the way `ClientRoot` mounts `SpecVersionsProvider` through
 *      `<SpecVersions>`, is exactly the case that bit us).
 *   4. A mounter whose own body calls a reader hook is a violation.
 *
 * Rendering a reader as a CHILD is not a violation — that is the whole point of
 * a provider, and children are inside the returned tree. Only hook calls in the
 * mounter's own body are flagged, which is what makes the check quiet enough to
 * gate a build on.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

/** Every .ts/.tsx file under src/, minus generated and test files. */
function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Body of the function starting at `openParen`'s matching brace.
 *
 * Brace matching rather than a parser: string and comment contents can contain
 * unbalanced braces, so both are skipped explicitly. A template literal's
 * `${...}` nests real code, and its braces balance, so counting through it is
 * correct.
 */
function readBody(text, from) {
  const open = text.indexOf('{', from);
  if (open === -1) return { body: '', end: text.length };

  let depth = 0;
  let i = open;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '/' && next === '/') {
      const nl = text.indexOf('\n', i);
      i = nl === -1 ? text.length : nl;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = text.indexOf('*/', i);
      i = close === -1 ? text.length : close + 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2;
          continue;
        }
        if (text[i] === quote) break;
        // A template literal's `${}` holds real code with real braces; letting
        // the outer loop count them is what keeps the depth honest.
        if (quote === '`' && text[i] === '$' && text[i + 1] === '{') break;
        i += 1;
      }
      if (quote === '`' && text[i] === '$') {
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { body: text.slice(open, i + 1), end: i + 1 };
    }
    i += 1;
  }
  return { body: text.slice(open), end: text.length };
}

/**
 * Index just past the `open`/`close` pair that starts at or after `from`.
 *
 * Used to step over a parameter list, which can contain braces, nested parens,
 * default values and strings.
 */
function skipBalanced(text, from, open, close) {
  let i = text.indexOf(open, from);
  if (i === -1) return from;
  let depth = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < text.length && text[i] !== quote) i += text[i] === '\\' ? 2 : 1;
    } else if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return text.length;
}

const FUNCTION_DECL =
  /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^(]*>)?\s*\(/g;
const ARROW_DECL =
  /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]+?)?=>\s*\{/g;

/** name -> { file, hookCalls:Set, jsx:Set } for every top-level function. */
function collectFunctions(files) {
  const functions = new Map();

  const add = (name, file, body) => {
    const hookCalls = new Set();
    for (const m of body.matchAll(/\b(use[A-Z][\w$]*)\s*\(/g)) hookCalls.add(m[1]);

    const jsx = new Set();
    for (const m of body.matchAll(/<\s*([A-Z][\w$]*)/g)) jsx.add(m[1]);
    // `{(versions) => <Provider value={versions}>` and friends: a provider
    // mounted from a render-prop is mounted by the enclosing component, and
    // the JSX scan above already sees it.

    const existing = functions.get(name);
    if (existing) {
      // Same name in two files. Merging is the conservative choice: it can
      // only add edges, so the check stays sound and at worst over-reports.
      existing.files.add(file);
      hookCalls.forEach((h) => existing.hookCalls.add(h));
      jsx.forEach((c) => existing.jsx.add(c));
      return;
    }
    functions.set(name, { files: new Set([file]), hookCalls, jsx });
  };

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    FUNCTION_DECL.lastIndex = 0;
    let match = FUNCTION_DECL.exec(text);
    while (match) {
      // Skip the parameter list before looking for the body. A destructured
      // parameter — `function ClientRoot({ children }: Props) {` — opens a
      // brace of its own, and taking that as the body reads `{ children }`
      // instead of the component, which silently empties the analysis: no JSX,
      // no hook calls, no findings, from the very components most likely to
      // mount a provider.
      const afterParams = skipBalanced(text, match.index + match[0].length - 1, '(', ')');
      const { body } = readBody(text, afterParams);
      add(match[1], file, body);
      match = FUNCTION_DECL.exec(text);
    }

    ARROW_DECL.lastIndex = 0;
    match = ARROW_DECL.exec(text);
    while (match) {
      // This one ends ON the body brace, so no parameter skipping is needed.
      const { body } = readBody(text, match.index + match[0].length - 1);
      add(match[1], file, body);
      match = ARROW_DECL.exec(text);
    }
  }

  return functions;
}

/**
 * Context modules: the exported `*Provider` and the hooks reading it.
 *
 * Keyed by provider name because that is what shows up in JSX, and matched
 * within a file because a context, its provider and its hook are always
 * declared together in this codebase (`useSpecVersions.ts`, `useMatrixClient.ts`,
 * `useCapabilities.ts`, …).
 */
function collectContexts(files) {
  const contexts = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('createContext')) continue;

    for (const m of text.matchAll(
      /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*([A-Za-z_$][\w$]*)\.Provider/g,
    )) {
      const [, providerName, contextName] = m;

      const readers = new Set();
      for (const fn of text.matchAll(
        /(?:export\s+)?(?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=)/g,
      )) {
        const name = fn[1] ?? fn[2];
        if (!name || !name.startsWith('use')) continue;
        const { body } = readBody(text, fn.index + fn[0].length);
        if (new RegExp(`useContext\\s*\\(\\s*${contextName}\\s*\\)`).test(body)) readers.add(name);
      }

      if (readers.size > 0) contexts.push({ file, providerName, readers });
    }
  }

  return contexts;
}

/** Everything that transitively calls one of `seeds` as a hook. */
function transitiveCallers(functions, seeds) {
  const reached = new Set(seeds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, fn] of functions) {
      if (reached.has(name)) continue;
      for (const called of fn.hookCalls) {
        if (reached.has(called)) {
          reached.add(name);
          grew = true;
          break;
        }
      }
    }
  }
  return reached;
}

/** Everything that transitively renders one of `seeds` in its JSX. */
function transitiveMounters(functions, seeds) {
  const reached = new Set(seeds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, fn] of functions) {
      if (reached.has(name)) continue;
      for (const rendered of fn.jsx) {
        if (reached.has(rendered)) {
          reached.add(name);
          grew = true;
          break;
        }
      }
    }
  }
  return reached;
}

const files = sourceFiles(SRC);
const functions = collectFunctions(files);
const contexts = collectContexts(files);

if (contexts.length === 0) {
  // A silent pass here would mean "no contexts found", which is never true in
  // this codebase and would hide a broken analysis rather than a clean tree.
  console.error('check-context-hooks: found no context providers — the scan is broken.');
  process.exit(1);
}

const violations = [];

for (const { providerName, readers } of contexts) {
  const readerFns = transitiveCallers(functions, readers);
  const mounters = transitiveMounters(functions, [providerName]);

  for (const mounter of mounters) {
    const fn = functions.get(mounter);
    if (!fn) continue;
    for (const called of fn.hookCalls) {
      if (!readerFns.has(called)) continue;
      violations.push({
        component: mounter,
        files: [...fn.files].map((f) => relative(ROOT, f)),
        hook: called,
        providerName,
        reader: readers.has(called) ? called : [...readers][0],
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    'check-context-hooks: a component calls a hook that reads a context it mounts.\n' +
      'A hook in the body runs outside the tree the component returns, so the read\n' +
      'throws at runtime. Move the call into a child of the provider.\n',
  );
  for (const v of violations) {
    console.error(
      `  ${v.component} (${v.files.join(', ')})\n` +
        `    calls ${v.hook}(), which reads the context mounted by <${v.providerName}>\n` +
        `    (via ${v.reader})\n`,
    );
  }
  process.exit(1);
}

console.log(
  `check-context-hooks: ${contexts.length} context providers, ${functions.size} functions, no violations.`,
);

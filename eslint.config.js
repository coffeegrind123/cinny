import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', 'src/sw.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  jsxA11y.flatConfigs.recommended,
  importPlugin.flatConfigs?.recommended,
  prettier,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        JSX: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
    },
    rules: {
      'linebreak-style': 'off',
      'no-underscore-dangle': 'off',
      'no-shadow': 'off',
      'import/prefer-default-export': 'off',
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
      'react/jsx-filename-extension': ['error', { extensions: ['.tsx', '.jsx'] }],
      'react/require-default-props': 'off',
      'react/jsx-props-no-spreading': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // A leading underscore is the conventional marker for a binding that
      // must exist to satisfy a signature but is deliberately not read — e.g.
      // `getResponseHeader(_name: string)` implementing an interface. Deleting
      // those would break the signature, so honour the convention instead.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Every hit is `export const X = forwardRef(...)` or folds' `as(...)`,
      // which is this codebase's component idiom throughout. The components are
      // named exports, so their identity is obvious in source and React infers
      // the name from the binding in dev builds. Setting displayName on 27
      // components to satisfy a rule that is describing an idiom, not a defect,
      // buys nothing.
      'react/display-name': 'off',
      // Autofocus is flagged wholesale, but every occurrence is the primary
      // input of a dialog, prompt or search popover. Moving focus into a
      // dialog on open is what the WAI-ARIA dialog pattern asks for; not doing
      // it is the accessibility bug.
      'jsx-a11y/no-autofocus': 'off',
      // The media elements here play third-party and user-sent files — Twitter
      // clips, a raw .mp4 someone linked. No caption track exists or could,
      // so the rule cannot be satisfied by anything except not rendering media.
      'jsx-a11y/media-has-caption': 'off',
      // `while (true)` in the vendored E2E key crypto is a deliberate loop, not
      // an accidental constant test.
      'no-constant-condition': ['error', { checkLoops: false }],
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    rules: { 'no-undef': 'off' },
  },
  {
    // `import/named` cannot see TypeScript's type-only exports, so it reports
    // every one of them as missing — `RectCords` from folds, `AuthDict` and
    // `UIAFlow` from matrix-js-sdk, and 285 more. They all exist; the rule is
    // resolving JavaScript exports against a TypeScript surface. eslint-plugin-import
    // documents turning it off for TS precisely because the compiler already
    // enforces this, and `npm run typecheck` is what actually catches a genuinely
    // missing export.
    files: ['**/*.{ts,tsx}'],
    rules: { 'import/named': 'off' },
  },
];

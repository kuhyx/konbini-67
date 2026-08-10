import js from '@eslint/js'
import react from '@eslint-react/eslint-plugin'
import vitest from '@vitest/eslint-plugin'
import { defineConfig } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import sonarjs from 'eslint-plugin-sonarjs'
import unicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      react.configs['strict-type-checked'],
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      unicorn.configs['flat/recommended'],
      sonarjs.configs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `unicorn/name-replacements` and `@eslint-react`'s ref-name rule are
      // mutually unsatisfiable for any `useRef` variable: the first rejects
      // `ref`/`Ref` as an abbreviation, the second requires that exact suffix.
      // Both arrive from presets, so neither was a deliberate choice. Refs get
      // their conventional React name; every other abbreviation stays banned.
      'unicorn/name-replacements': ['error', { replacements: { ref: false } }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-shadow': 'error',
      'no-console': 'error',
      'eqeqeq': ['error', 'always'],
      'prefer-const': ['error', { destructuring: 'all' }],
      // Determinism is a hard requirement: a seeded shift must replay identically.
      // Every source of nondeterminism arrives through an injected Rng or Clock.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Nondeterministic — take an injected Rng (src/core/rng.ts).',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Nondeterministic — take an injected Clock (src/core/clock.ts).',
        },
        {
          object: 'performance',
          property: 'now',
          message: 'Nondeterministic — take an injected Clock (src/core/clock.ts).',
        },
      ],
    },
  },
  {
    // The one place real time may be read; everything else receives a Clock.
    files: ['src/core/clock.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    // Colocated tests, so these globs must match src/**, not a tests/ dir —
    // otherwise the determinism ban above fires inside the tests themselves.
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.ts'],
    extends: [vitest.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-restricted-properties': 'off',
    },
  },
  {
    // Build config files: linted, but outside the type-aware/React project
    // above — @eslint-react's typed rules hard-error without parser services.
    files: ['eslint.config.js', 'vite.config.ts'],
    extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
)

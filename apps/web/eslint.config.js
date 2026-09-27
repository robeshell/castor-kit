import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // The core rule doesn't understand JSX usage: treat capitalized component names and member expressions like <motion.div> as used
      'no-unused-vars': ['error', { varsIgnorePattern: '^(?:[A-Z_]|motion$)', argsIgnorePattern: '^(?:[A-Z_]|_)' }],
    },
  },
  {
    // TypeScript: the same React rules plus typescript-eslint's recommended set (the frontend is moving to TSX file by file)
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // By convention Context files export both the Provider and a useXxx hook; shadcn / AI Elements files export helpers next to components
    files: ['src/context/**/*.{js,jsx,ts,tsx}', 'src/components/ui/**/*.{js,jsx,ts,tsx}', 'src/components/ai-elements/**/*.{js,jsx,ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['**/*.{test,spec}.{js,jsx,ts,tsx}', 'test/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
  },
])

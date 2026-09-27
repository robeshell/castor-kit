import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'drizzle/**', 'instance/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // Timestamp output must go through common/serialize.toIso / utcNowIso (ISO 8601 in UTC with 6-digit microseconds; toISOString keeps milliseconds only)
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='toISOString']",
          message: '禁止 Date#toISOString()：时间输出用 common/serialize 的 toIso() / utcNowIso()',
        },
      ],
      // Allow let in a destructuring as long as one of the variables is reassigned (date/time parsing code uses this pattern heavily)
      'prefer-const': ['error', { destructuring: 'all' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
)

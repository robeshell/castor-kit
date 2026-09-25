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
      // 时间输出必须走 common/serialize.toIso / utcNowIso（isoformat 风格：无 Z、6 位微秒，见 docs/architecture.md §4.2）
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='toISOString']",
          message: '禁止 Date#toISOString()：时间输出用 common/serialize 的 toIso() / utcNowIso()',
        },
      ],
      // 实现 Python 语义的 str.strip / isspace / 控制字符判断时，正则与字符串里会有意出现控制字符与 Unicode 空白
      'no-control-regex': 'off',
      'no-irregular-whitespace': ['error', { skipStrings: true, skipRegExps: true, skipTemplates: true, skipComments: true }],
      // 解构里只要有一个变量会被重新赋值就允许 let（日期时间解析等代码大量使用这种写法）
      'prefer-const': ['error', { destructuring: 'all' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
)

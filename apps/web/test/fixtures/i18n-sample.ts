// Fixture for test/i18n.test.js: a .ts file with a generic arrow (misread as JSX if parsed with the jsx plugin)
export const first = <T>(items: T[]): T | undefined => items[0]

export const message = (t: (key: string) => string, name: string) => [t('这是一句没有译文的中文'), `你好 ${name}`]

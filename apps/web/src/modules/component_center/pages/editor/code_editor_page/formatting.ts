/**
 * Languages Monaco can format out of the box: only these ship a document formatter (the TypeScript, JSON, HTML and
 * CSS language services). For the others (Python, SQL, Java) the format action does nothing and still resolves.
 */
const FORMATTABLE_LANGUAGES: ReadonlySet<string> = new Set(['javascript', 'typescript', 'json', 'html', 'css'])

export const canFormat = (language: string): boolean => FORMATTABLE_LANGUAGES.has(language)

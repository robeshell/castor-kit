/**
 * Short "Browser · OS" label from a User-Agent string, for session lists. Good enough for people to recognize their
 * own devices; anything unrecognized is shown as the (shortened) raw string.
 */
const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)/, 'Opera'],
  [/Firefox\/(\d+)/, 'Firefox'],
  [/(?:Chrome|CriOS)\/(\d+)/, 'Chrome'],
  [/Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari\//, 'Safari'],
]
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

export interface UserAgentInfo {
  label: string
  mobile: boolean
}

export function describeUserAgent(ua: string | null | undefined): UserAgentInfo {
  if (!ua) return { label: '', mobile: false }
  const browser = BROWSERS.map(([re, label]) => ({ match: re.exec(ua), label })).find((b) => b.match)
  const system = SYSTEMS.find(([re]) => re.test(ua))
  const mobile = /Mobile|iPhone|Android/.test(ua)
  if (!browser && !system) return { label: ua.length > 60 ? `${ua.slice(0, 57)}…` : ua, mobile }
  const name = browser?.match ? `${browser.label} ${browser.match[1]}` : ''
  return { label: [name, system?.[1]].filter(Boolean).join(' · '), mobile }
}

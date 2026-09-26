/**
 * Short "Browser · OS" label from a User-Agent string, for session lists. Good enough for people to recognize their
 * own devices; anything unrecognized is shown as the (shortened) raw string.
 */
const BROWSERS = [
  [/Edg(?:e|A|iOS)?\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)/, 'Opera'],
  [/Firefox\/(\d+)/, 'Firefox'],
  [/(?:Chrome|CriOS)\/(\d+)/, 'Chrome'],
  [/Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari\//, 'Safari'],
]
const SYSTEMS = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

export function describeUserAgent(ua) {
  if (!ua) return { label: '', mobile: false }
  const browser = BROWSERS.find(([re]) => re.test(ua))
  const system = SYSTEMS.find(([re]) => re.test(ua))
  const mobile = /Mobile|iPhone|Android/.test(ua)
  if (!browser && !system) return { label: ua.length > 60 ? `${ua.slice(0, 57)}…` : ua, mobile }
  const name = browser ? `${browser[1]} ${ua.match(browser[0])[1]}` : ''
  return { label: [name, system?.[1]].filter(Boolean).join(' · '), mobile }
}

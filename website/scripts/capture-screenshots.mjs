/**
 * Capture real screenshots of the running app for the landing page and the README.
 *
 *   pnpm dev                                   # API :5001 + web :5173 must be running
 *   npm --prefix website run screenshots       # asks for the admin password (input hidden)
 *
 * Env: CASTOR_URL (default http://localhost:5173), CASTOR_USER (default admin), CASTOR_PASSWORD (skips the prompt).
 * Uses the locally installed Google Chrome through playwright-core; no browser download.
 *
 * Output (WebP):
 *   website/public/screenshots/<lang>/<view>-<theme>.webp   views: dashboard, list, appearance, top-nav, login
 *   website/public/screenshots/accent/<accent>-<theme>.webp  the dashboard in each accent (English UI)
 *   .github/assets/screenshot-<theme>.webp                  README hero (English dashboard)
 */
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'
import { chromium } from 'playwright-core'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'website', 'public', 'screenshots')
const BASE = (process.env.CASTOR_URL ?? 'http://localhost:5173').replace(/\/$/, '')
const USER = process.env.CASTOR_USER ?? 'admin'

const LANGS = ['zh-CN', 'en-US', 'ja-JP']
const THEMES = ['light', 'dark']
const ACCENTS = ['ocean', 'violet', 'emerald', 'rose', 'amber', 'slate']
const VIEWPORT = { width: 1440, height: 900 }
const APPEARANCE = { accent: 'ocean', navMode: 'sidebar', sidebarVariant: 'sidebar', contentWidth: 'boxed', tagsView: true }
// Pages opened before the shot so the tabs bar looks like real use
const WARM_UP = ['/system/users', '/system/logs']
// Label of the appearance button in each language (aria-label)
const APPEARANCE_LABEL = { 'zh-CN': '外观设置', 'en-US': 'Appearance', 'ja-JP': '外観設定' }

function askPassword() {
  if (process.env.CASTOR_PASSWORD) return Promise.resolve(process.env.CASTOR_PASSWORD)
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (text) => {
      if (text.includes('Password')) rl.output.write(text)
    }
    rl.question(`Password for ${USER}: `, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

/** Viewport screenshot as WebP via the Chrome DevTools protocol (Playwright itself only writes PNG / JPEG) */
async function shot(page, file) {
  const cdp = await page.context().newCDPSession(page)
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'webp', quality: 82 })
  await cdp.detach()
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, Buffer.from(data, 'base64'))
  console.log('  ✓', file.replace(`${ROOT}/`, ''))
}

/** Let requests, charts and entrance animations settle */
async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1600)
}

async function newContext(browser, { lang, theme, appearance = APPEARANCE, storageState }) {
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: theme, locale: lang, storageState })
  await context.addInitScript(
    ([lang, theme, appearance]) => {
      localStorage.setItem('lang', lang)
      localStorage.setItem('theme', theme)
      localStorage.setItem('appearance', JSON.stringify(appearance))
    },
    [lang, theme, appearance],
  )
  return context
}

async function openWithTabs(context, path) {
  const page = await context.newPage()
  for (const warm of WARM_UP) {
    await page.goto(BASE + warm)
    await settle(page)
  }
  await page.goto(BASE + path)
  await settle(page)
  return page
}

async function main() {
  const password = await askPassword()
  const browser = await chromium.launch({ channel: 'chrome' })

  // Sign in once and reuse the session cookie for every context
  const loginContext = await browser.newContext({ viewport: VIEWPORT })
  const loginPage = await loginContext.newPage()
  await loginPage.goto(`${BASE}/login`)
  await loginPage.fill('#username', USER)
  await loginPage.fill('#password', password)
  await loginPage.click('button[type="submit"]')
  await loginPage.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {
    throw new Error('Sign-in failed: check the password and that the API is running')
  })
  const storageState = await loginContext.storageState()
  await loginContext.close()

  for (const lang of LANGS) {
    for (const theme of THEMES) {
      console.log(`${lang} · ${theme}`)
      const dir = join(OUT, lang)

      const context = await newContext(browser, { lang, theme, storageState })
      let page = await openWithTabs(context, '/dashboard')
      await shot(page, join(dir, `dashboard-${theme}.webp`))

      await page.goto(`${BASE}/system/logs`)
      await settle(page)
      await shot(page, join(dir, `list-${theme}.webp`))

      await page.goto(`${BASE}/dashboard`)
      await settle(page)
      await page.click(`button[aria-label="${APPEARANCE_LABEL[lang]}"]`)
      await page.waitForTimeout(600)
      await shot(page, join(dir, `appearance-${theme}.webp`))
      await context.close()

      const topContext = await newContext(browser, { lang, theme, storageState, appearance: { ...APPEARANCE, navMode: 'top' } })
      page = await openWithTabs(topContext, '/dashboard')
      await shot(page, join(dir, `top-nav-${theme}.webp`))
      await topContext.close()

      // Signed out: the login page
      const guest = await newContext(browser, { lang, theme })
      page = await guest.newPage()
      await page.goto(`${BASE}/login`)
      await settle(page)
      await shot(page, join(dir, `login-${theme}.webp`))
      await guest.close()
    }
  }

  for (const theme of THEMES) {
    console.log(`accents · ${theme}`)
    for (const accent of ACCENTS) {
      const context = await newContext(browser, { lang: 'en-US', theme, storageState, appearance: { ...APPEARANCE, accent } })
      const page = await openWithTabs(context, '/dashboard')
      await shot(page, join(OUT, 'accent', `${accent}-${theme}.webp`))
      await context.close()
    }
    await copyFile(join(OUT, 'en-US', `dashboard-${theme}.webp`), join(ROOT, '.github', 'assets', `screenshot-${theme}.webp`))
  }

  await browser.close()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})

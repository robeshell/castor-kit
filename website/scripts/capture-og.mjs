/**
 * Render the social preview image (GitHub social preview + Open Graph image of the docs site).
 *
 *   npm --prefix website run screenshots   # first: refreshes screenshots/en-US/dashboard-dark.webp
 *   npm --prefix website run og
 *
 * Output (1280×640 PNG): website/public/og.png and .github/assets/social-preview.png.
 * The GitHub social preview is not read from the repository: upload .github/assets/social-preview.png
 * under Settings → General → Social preview after changing it.
 * Uses the locally installed Google Chrome through playwright-core; no browser download.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUTPUTS = [join(ROOT, 'website', 'public', 'og.png'), join(ROOT, '.github', 'assets', 'social-preview.png')]

const dataUrl = async (file, type) => `data:${type};base64,${(await readFile(file)).toString('base64')}`

async function main() {
  const wordmark = await dataUrl(join(ROOT, '.github', 'assets', 'wordmark-dark.svg'), 'image/svg+xml')
  const dashboard = await dataUrl(join(ROOT, 'website', 'public', 'screenshots', 'en-US', 'dashboard-dark.webp'), 'image/webp')
  const tags = ['Fastify', 'React 19', 'shadcn/ui', 'PostgreSQL', 'TypeScript', 'MIT']

  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;700;800&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 640px; overflow: hidden; font-family: Geist, system-ui, sans-serif; color: #f5f5f5;
    background: radial-gradient(640px 420px at 18% 30%, rgba(37,99,235,.28), transparent 70%),
                radial-gradient(560px 380px at 92% 8%, rgba(34,211,238,.16), transparent 70%), #07090f; }
  .grid { position: absolute; inset: 0; opacity: .5;
    background-image: linear-gradient(rgba(148,163,184,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.07) 1px, transparent 1px);
    background-size: 40px 40px; }
  .copy { position: absolute; left: 84px; top: 140px; width: 560px; }
  .wordmark { height: 104px; margin-left: -8px; display: block; }
  h1 { margin-top: 40px; font-size: 40px; white-space: nowrap; line-height: 1.12; font-weight: 800; letter-spacing: -.03em; }
  h1 span { background: linear-gradient(90deg, #3b82f6, #22d3ee); -webkit-background-clip: text; color: transparent; }
  p { margin-top: 20px; font-size: 21px; line-height: 1.5; color: #a3a3a3; }
  .tags { margin-top: 32px; display: flex; gap: 8px; }
  .tags span { font-size: 15px; font-weight: 500; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); }
  .shot { position: absolute; left: 680px; top: 92px; width: 1040px; border-radius: 14px; overflow: hidden;
    border: 1px solid rgba(255,255,255,.14); box-shadow: 0 40px 120px rgba(0,0,0,.6);
    transform: perspective(1800px) rotateY(-14deg) rotateX(4deg); transform-origin: left center; }
  .shot .bar { height: 30px; background: #111318; display: flex; gap: 8px; align-items: center; padding-left: 14px; }
  .shot .bar i { width: 10px; height: 10px; border-radius: 50%; background: #3f3f46; }
  .shot img { display: block; width: 100%; }
</style></head>
<body>
  <div class="grid"></div>
  <div class="shot"><div class="bar"><i></i><i></i><i></i></div><img src="${dashboard}" alt=""></div>
  <div class="copy">
    <img class="wordmark" src="${wordmark}" alt="Castor">
    <h1>The AI-first admin framework<br><span>for Node.js and React.</span></h1>
    <p>Describe a feature: the table, API, UI, permissions and tests arrive together, checked before delivery.</p>
    <div class="tags">${tags.map((t) => `<span>${t}</span>`).join('')}</div>
  </div>
</body></html>`

  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 } })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const png = await page.screenshot({ type: 'png' })
  await browser.close()
  for (const file of OUTPUTS) {
    await writeFile(file, png)
    console.log('  ✓', file.replace(`${ROOT}/`, ''))
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})

// Captures screenshots of each screen at phone/tablet sizes in light and dark themes.
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir]
// Requires the dev server (npm run dev) and `npx playwright install chromium`.
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173/'
const OUT = process.argv[3] ?? 'screenshots'

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  ipad: { width: 820, height: 1180 },
  'ipad-landscape': { width: 1180, height: 820 },
}

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()

for (const theme of ['light', 'dark']) {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: theme,
    })
    page.on('pageerror', (e) =>
      console.error(`[${name}/${theme}] page error:`, e.message),
    )
    await page.addInitScript(() => {
      if (!localStorage.getItem('kiano-settings')) {
        localStorage.setItem(
          'kiano-settings',
          JSON.stringify({ state: { quizLength: 5 }, version: 1 }),
        )
      }
    })
    const shot = (label) =>
      page.screenshot({ path: `${OUT}/${name}-${theme}-${label}.png`, fullPage: true })

    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await shot('1-start')

    // Settings drawer: top, then scrolled to the middle and bottom (it scrolls internally).
    await page.getByRole('button', { name: 'Settings' }).first().click()
    await page.waitForTimeout(500)
    const drawerShot = (label) =>
      page.screenshot({ path: `${OUT}/${name}-${theme}-${label}.png` })
    await drawerShot('1a-settings')
    const body = page.locator('[role="dialog"] > div').last()
    await body.evaluate((el) => (el.scrollTop = el.scrollHeight * 0.4))
    await page.waitForTimeout(300)
    await drawerShot('1b-settings-middle')
    await body.evaluate((el) => (el.scrollTop = el.scrollHeight))
    await page.waitForTimeout(300)
    await drawerShot('1c-settings-bottom')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)

    await page.getByRole('button', { name: /play/i }).click()
    await page.locator('svg').first().waitFor()
    await page.waitForTimeout(600)
    await shot('2-quiz')

    const choices = page.locator('ol li button')
    await choices.nth(0).click()
    await page.waitForTimeout(400)
    await shot('3-confirm')

    // Answer every question, trying choices in order until one is right.
    for (let q = 0; q < 5; q++) {
      for (let i = 0; i < 3; i++) {
        const btn = choices.nth(i)
        if (await btn.isDisabled()) continue
        await btn.click()
        // First tap may only arm the "Sure?" state; tap again to confirm.
        if (!(await btn.isDisabled())) await btn.click()
        await page.waitForTimeout(450)
        if (q === 0 && i === 0) await shot('4-after-first-answer')
        const next = page.getByRole('button', { name: /next|see results/i })
        if (await next.isVisible()) {
          if (q === 0) await shot('5-solved')
          await next.click()
          await page.waitForTimeout(300)
          break
        }
      }
    }
    await page.waitForTimeout(800)
    await shot('6-summary')

    await page.getByRole('button', { name: /home/i }).click()
    await page.getByRole('button', { name: /my stats/i }).click()
    await page.waitForTimeout(800)
    await shot('7-stats')
    await page.close()
  }
}

await browser.close()
console.log(`Saved screenshots to ${OUT}/`)

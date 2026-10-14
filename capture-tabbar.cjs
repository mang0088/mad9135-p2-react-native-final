/* Captures the floating animated tab bar in both states, and verifies the
   icon actually scales / the label actually fades after a tap. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = 'http://localhost:8099';
const OUT = path.join(__dirname, 'screenshots', 'tabbar');
const IPHONE_15 = { width: 393, height: 852, deviceScaleFactor: 3 };

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });

  const page = await browser.newPage();
  await page.setViewport(IPHONE_15);

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(7000);

  /** Reads the tab bar geometry and each tab's icon transform. */
  const readState = () =>
    page.evaluate(() => {
      const bar = document.querySelector('[role="tablist"]');
      if (!bar) return null;

      const style = window.getComputedStyle(bar);
      const r = bar.getBoundingClientRect();

      const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map((el) => {
        const icon = el.querySelector('svg');
        const label = Array.from(el.querySelectorAll('*')).find(
          (n) => n.children.length === 0 && (n.textContent || '').trim().length > 0
        );
        const ir = icon ? icon.getBoundingClientRect() : null;
        return {
          label: label ? (label.textContent || '').trim() : '',
          selected: el.getAttribute('aria-selected') === 'true',
          iconWidth: ir ? Math.round(ir.width * 10) / 10 : null,
          iconTop: ir ? Math.round(ir.top * 10) / 10 : null,
          labelOpacity: label ? window.getComputedStyle(label).opacity : null,
        };
      });

      return {
        bar: {
          position: style.position,
          bottom: Math.round(r.bottom),
          left: Math.round(r.left),
          width: Math.round(r.width),
          borderRadius: style.borderTopLeftRadius,
          background: style.backgroundColor,
          shadow: style.boxShadow !== 'none',
        },
        tabs,
      };
    });

  const before = await readState();
  console.log('BEFORE TAP');
  console.log(JSON.stringify(before, null, 2));

  await page.screenshot({
    path: path.join(OUT, 'tabbar-01-explore-active.png'),
    fullPage: false,
  });

  // Tap the Cook tab by its accessible label.
  await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Recipes and cooking tab"]');
    el.click();
  });

  await sleep(120);
  const mid = await readState();
  console.log('\nMID-ANIMATION (120ms)');
  console.log(JSON.stringify(mid.tabs, null, 2));

  await sleep(1400);
  const after = await readState();
  console.log('\nAFTER ANIMATION');
  console.log(JSON.stringify(after, null, 2));

  await page.screenshot({
    path: path.join(OUT, 'tabbar-02-cook-active.png'),
    fullPage: false,
  });

  // Tap back to check it reverses and returns to the original state.
  await page.evaluate(() => {
    document.querySelector('[aria-label="Explore tab"]').click();
  });
  await sleep(1400);

  const reverted = await readState();
  console.log('\nAFTER REVERSING BACK TO EXPLORE');
  console.log(JSON.stringify(reverted.tabs, null, 2));

  await page.screenshot({
    path: path.join(OUT, 'tabbar-03-reverted.png'),
    fullPage: false,
  });

  console.log('\nerrors:', errors.length ? [...new Set(errors)].slice(0, 5) : 'none');
  console.log('screenshots:', OUT);

  await browser.close();
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
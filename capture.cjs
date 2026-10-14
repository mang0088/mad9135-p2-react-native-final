/* Drives the exported web build in the installed Chrome and captures real
   screenshots at the iPhone 15 viewport (393 x 852 CSS px).

   Usage: node capture.cjs
   Screenshots land in screenshots/mobile-preview/. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = 'http://localhost:8099';
const OUT = path.join(__dirname, 'screenshots', 'mobile-preview');

// iPhone 15 logical viewport.
const IPHONE_15 = { width: 393, height: 852, deviceScaleFactor: 3 };

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('No Chrome or Edge installation found.');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Waits for React to paint and any API calls in flight to settle. */
async function settle(page, ms = 3500) {
  await sleep(ms);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  );
}

/**
 * Scrolls the app's own scroll container.
 *
 * React Native Web renders ScrollView as a scrollable div, not the document, so
 * window.scrollTo has no effect. This finds the tallest scrollable element and
 * scrolls that instead.
 */
async function scrollApp(page, y) {
  const applied = await page.evaluate((top) => {
    const scroller = Array.from(document.querySelectorAll('div')).find((el) => {
      if (el.scrollHeight <= el.clientHeight + 40) return false;
      const style = window.getComputedStyle(el);
      return (
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll' ||
        style.overflow === 'auto' ||
        style.overflow === 'scroll'
      );
    });

    if (!scroller) return { ok: false, reason: 'no scrollable element' };

    const max = scroller.scrollHeight - scroller.clientHeight;
    scroller.scrollTop = Math.min(top, max);
    return { ok: true, scrollTop: scroller.scrollTop, max, height: scroller.scrollHeight };
  }, y);

  if (!applied.ok) console.log('  scroll:', applied.reason);
  else console.log(`  scroll -> ${applied.scrollTop}/${applied.max} (content ${applied.height}px)`);

  await sleep(700);
}

/** Scrolls the section whose heading contains `text` into view. */
async function scrollToHeading(page, text) {
  const found = await page.evaluate((needle) => {
    const scroller = Array.from(document.querySelectorAll('div')).find((el) => {
      if (el.scrollHeight <= el.clientHeight + 40) return false;
      const s = window.getComputedStyle(el);
      return s.overflowY === 'auto' || s.overflowY === 'scroll';
    });
    if (!scroller) return false;

    const target = Array.from(document.querySelectorAll('div')).find(
      (el) =>
        el.children.length === 0 &&
        (el.textContent || '').trim().toLowerCase().includes(needle.toLowerCase())
    );
    if (!target) return false;

    const scrollerTop = scroller.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    scroller.scrollTop += targetTop - scrollerTop - 16;
    return true;
  }, text);

  if (!found) console.log(`  heading not found: ${text}`);
  await sleep(800);
}

/**
 * Clicks an element identified by its accessibility label.
 *
 * React Navigation renders bottom tabs as <a role="tab" aria-label="...">,
 * so aria-label is the most reliable hook - text matching hits inner spans
 * that are not themselves clickable.
 */
async function clickByLabel(page, ariaLabel, role = null) {
  const clicked = await page.evaluate(
    (label, r) => {
      const nodes = Array.from(document.querySelectorAll('[aria-label]'));
      const match = nodes.find(
        (n) =>
          n.getAttribute('aria-label') === label && (r ? n.getAttribute('role') === r : true)
      );
      if (!match) return false;
      match.scrollIntoView({ block: 'center' });
      match.click();
      return true;
    },
    ariaLabel,
    role
  );

  if (clicked) await sleep(400);
  return clicked;
}

/** Clicks the first element whose aria-label contains `text`. */
async function clickContaining(page, text) {
  const clicked = await page.evaluate((needle) => {
    const nodes = Array.from(document.querySelectorAll('[aria-label]'));
    const match = nodes.find((n) => {
      const l = (n.getAttribute('aria-label') || '').toLowerCase();
      return l.includes(needle.toLowerCase());
    });
    if (!match) return false;
    match.scrollIntoView({ block: 'center' });
    match.click();
    return true;
  }, text);

  if (clicked) await sleep(400);
  return clicked;
}

async function shoot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(`  captured ${name} (${kb} KB)`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--font-render-hinting=none'],
  });

  const page = await browser.newPage();
  await page.setViewport(IPHONE_15);
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  );

  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });

  console.log('opening app...');
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 90000 });
  await settle(page, 7000);

  // 01 - Home top (header, hero search, top of the menu carousel)
  await shoot(page, '01-home-top.png');

  // 02 - Menu explorer: open the first real menu item's details
  const openedMenu = await clickContaining(page, 'View menu item details');
  if (openedMenu) {
    await settle(page, 4500);
    await shoot(page, '02-menu-item-details.png');
  }

  // Reload rather than history-back: restoring the exact scrollable DOM is more
  // reliable than relying on SPA history state.
  await page.reload({ waitUntil: 'networkidle2' });
  await settle(page, 7000);

  // Scroll to each Explore section by its heading.
  await scrollToHeading(page, 'Watch & discover');
  await settle(page, 1500);
  await shoot(page, '04-home-food-videos.png');

  await scrollToHeading(page, 'Something to chew over');
  await settle(page, 1500);
  await shoot(page, '05-home-trivia.png');

  await scrollToHeading(page, 'Nutrition Lens');
  await settle(page, 1500);
  await shoot(page, '06-nutrition-lens.png');

  // Nutrition estimate: type a dish and submit
  const typed = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="vegetable fried rice"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    setter.call(input, 'vegetable fried rice');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  });

  if (typed) {
    await sleep(800);
    const submitted = await clickByLabel(page, 'Estimate nutrition for this dish');
    if (submitted) {
      await settle(page, 5500);
      await shoot(page, '06b-nutrition-result.png');

      // Scroll the result panel fully into view.
      await scrollToHeading(page, 'Nutrition Lens');
      await scrollApp(page, 99999);
      await settle(page, 1200);
      await shoot(page, '06c-nutrition-values.png');
    }
  }

  // 11 - branded image fallback, proven by a failed image request
  await scrollApp(page, 0);
  await settle(page, 1200);
  await page.evaluate(() => {
    // Break one loaded image to show the real fallback path in action.
    const img = Array.from(document.querySelectorAll('img')).find((i) =>
      (i.src || '').includes('spoonacular')
    );
    if (img) img.dispatchEvent(new Event('error'));
  });
  await settle(page, 1200);
  await shoot(page, '11-image-fallback.png');

  // 12 - bottom tab navigation
  await page.reload({ waitUntil: 'networkidle2' });
  await settle(page, 7000);
  await shoot(page, '12-navigation.png');

  // Recipes tab
  const cookClicked = await clickByLabel(page, 'Recipes and cooking tab', 'tab');
  if (!cookClicked) {
    console.log('  (Cook tab not found)');
  } else {
    await settle(page, 7000);
    await shoot(page, '07-recipes-cook.png');

    const finderClicked = await clickByLabel(page, 'Find recipes by ingredients I already have');
    if (finderClicked) {
      await settle(page, 3000);
      await shoot(page, '08-ingredient-finder.png');

      // Add two suggested ingredients, then run a real search.
      await clickByLabel(page, 'Add chicken');
      await sleep(500);
      await clickByLabel(page, 'Add tomato');
      await sleep(500);
      await clickByLabel(page, 'Add garlic');
      await sleep(700);
      await shoot(page, '08b-ingredients-added.png');

      const searched = await clickByLabel(page, 'Find recipes with these ingredients');
      if (searched) {
        await settle(page, 7000);
        await shoot(page, '08c-ingredient-results.png');
      }

      await page.goBack().catch(() => {});
      await settle(page, 4000);
    }

    // Open the first recipe card to capture details and instructions.
    const recipeOpened = await clickContaining(page, 'Open recipe ');
    if (!recipeOpened) {
      console.log('  (no recipe card found on Cook tab)');
    } else {
      await settle(page, 7000);
      await shoot(page, '09-recipe-details.png');

      await scrollToHeading(page, 'Method');
      await settle(page, 1500);
      await shoot(page, '10-recipe-instructions.png');
    }
  }

  await browser.close();

  if (errors.length > 0) {
    console.log('\nRuntime issues observed:');
    for (const e of [...new Set(errors)].slice(0, 15)) console.log('  -', e);
  } else {
    console.log('\nNo page or console errors observed.');
  }

  console.log('\nScreenshots written to:', OUT);
})().catch((err) => {
  console.error('CAPTURE FAILED:', err.message);
  process.exit(1);
});
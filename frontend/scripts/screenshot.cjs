// Full-page screenshots of every page at 1440 px and 390 px.
//
//   NODE_PATH=<dir containing playwright> node scripts/screenshot.cjs [baseUrl] [filter]
//
// Playwright is not a project dependency; point NODE_PATH at any install whose browser build is present.
// Output: scripts/screenshots/<name>-<width>.png (git-ignored).

/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS so NODE_PATH can supply Playwright */
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");

const base = process.argv[2] || "http://localhost:3010";
const filter = process.argv[3] || "";
const out = path.join(__dirname, "screenshots");
fs.mkdirSync(out, { recursive: true });

const PAGES = [
  ["home", "/"],
  ["method", "/method"],
  ["assessments", "/assessments"],
  ["compare", "/countries"],
  ["score", "/score"],
  ["data", "/data"],
  ["about", "/about"],
  ["builder", "/builder"],
  ["ws-overview", "/countries/aurelia"],
  ["ws-indicators", "/countries/aurelia/indicators"],
  ["ws-weights", "/countries/aurelia/weights"],
  ["ws-budget", "/countries/aurelia/budget"],
  ["ws-scale", "/countries/aurelia/scale"],
  ["ws-optimum", "/countries/aurelia/optimum"],
  ["ws-record", "/countries/aurelia/record"],
  ["ws-sandbox", "/countries/aurelia/sandbox"],
  ["not-found", "/no-such-page"],
];

(async () => {
  const browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    for (const [name, url] of PAGES) {
      if (filter && !name.includes(filter)) continue;
      await page.goto(base + url, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1200);
      const file = path.join(out, `${name}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(`${name}-${width}.png${overflow > 0 ? `  HORIZONTAL OVERFLOW ${overflow}px` : ""}`);
    }
    await ctx.close();
  }
  await browser.close();
})();

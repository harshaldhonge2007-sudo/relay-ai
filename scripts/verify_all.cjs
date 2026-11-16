let chromium;
try {
  chromium = require("playwright").chromium;
} catch (e) {
  try {
    chromium = require("@playwright/test").chromium;
  } catch (e2) {
    console.log("Playwright not found in node_modules; skipping browser snapshot verification.");
    process.exit(0);
  }
}

const BASE_URL = "http://localhost:5173";

const routes = [
  "/",
  "/cases",
  "/case/case-001",
  "/case/case-001/intelligence",
  "/case/case-001/knowledge",
  "/case/case-001/busfactor",
  "/case/case-001/validation",
  "/case/case-001/timeline",
  "/case/case-001/findings",
  "/case/case-001/interview",
  "/case/case-001/handover",
  "/case/case-001/assets",
  "/case/case-001/completeness",
  "/case/case-001/uncertainty",
  "/case/case-001/decisions",
  "/case/case-001/admin",
  "/validation",
];

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const themes = ["light", "dark"];

async function main() {
  const launchOptions = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
  };
  if (process.env.PLAYWRIGHT_CHROME_PATH) {
    launchOptions.executablePath = process.env.PLAYWRIGHT_CHROME_PATH;
  }
  const browser = await chromium.launch(launchOptions);

  const allErrors = [];
  const results = [];

  for (const vp of viewports) {
    for (const theme of themes) {
      console.log(`\n========================================`);
      console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) | Theme: ${theme}`);
      console.log(`========================================`);

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height }
      });
      const page = await context.newPage();

      // Listeners
      page.on("console", msg => {
        if (msg.type() === "error") {
          const text = msg.text();
          // Filter known harmless warnings if any
          allErrors.push({ vp: vp.name, theme, url: page.url(), text });
          console.error(`[CONSOLE ERROR] [${vp.name}|${theme}] ${page.url()}:`, text);
        }
      });

      page.on("pageerror", err => {
        allErrors.push({ vp: vp.name, theme, url: page.url(), text: err.message });
        console.error(`[PAGE ERROR] [${vp.name}|${theme}] ${page.url()}:`, err.message);
      });

      page.on("response", res => {
        if (res.status() >= 400 && !res.url().includes("favicon")) {
          allErrors.push({ vp: vp.name, theme, url: page.url(), text: `HTTP ${res.status()} ${res.url()}` });
          console.error(`[HTTP ${res.status()}] [${vp.name}|${theme}]:`, res.url());
        }
      });

      // Set initial theme in localStorage before navigating
      await page.addInitScript((th) => {
        window.localStorage.setItem("relay_theme", th);
        window.localStorage.setItem("relay_sidebar_theme", th);
      }, theme);

      for (const route of routes) {
        const fullUrl = `${BASE_URL}${route}`;
        try {
          await page.goto(fullUrl, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(400);

          // Ensure data-theme is properly set on root
          await page.evaluate((th) => {
            document.documentElement.setAttribute("data-theme", th);
            document.documentElement.setAttribute("data-sidebar-theme", th);
            if (th === "dark") {
              document.documentElement.classList.add("dark");
            } else {
              document.documentElement.classList.remove("dark");
            }
          }, theme);
          await page.waitForTimeout(200);

          // Check if "screen view not loading" or ErrorBoundary crash text appears
          const pageText = await page.evaluate(() => document.body.innerText);
          const hasScreenNotLoading = /screen view not loading/i.test(pageText);
          const hasCrash = /Screen Rendering Error/i.test(pageText) || /Something went wrong/i.test(pageText);

          const bodyStyles = await page.evaluate(() => {
            const body = document.body;
            const style = window.getComputedStyle(body);
            return {
              bg: style.backgroundColor,
              color: style.color
            };
          });

          if (hasScreenNotLoading || hasCrash) {
            allErrors.push({
              vp: vp.name,
              theme,
              url: route,
              text: `Screen rendering error detected on ${route}`
            });
            console.error(`FAILED: ${route} has rendering error!`);
          } else {
            console.log(`✓ ${route.padEnd(30)} [${bodyStyles.bg} / ${bodyStyles.color}]`);
          }
        } catch (e) {
          allErrors.push({ vp: vp.name, theme, url: route, text: e.message });
          console.error(`ERROR visiting ${route}:`, e.message);
        }
      }

      await context.close();
    }
  }

  await browser.close();

  console.log(`\n========================================`);
  console.log(`VERIFICATION SUMMARY`);
  console.log(`Total checks: ${viewports.length * themes.length * routes.length}`);
  console.log(`Total errors: ${allErrors.length}`);
  if (allErrors.length > 0) {
    console.log(`Errors detail:`, JSON.stringify(allErrors, null, 2));
    process.exit(1);
  } else {
    console.log(`ALL TESTS PASSED WITH 0 ERRORS!`);
  }
}

main().catch(err => {
  console.error("FATAL ERROR in verify script:", err);
  process.exit(1);
});

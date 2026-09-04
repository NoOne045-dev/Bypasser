import { chromium } from "playwright";
import { BROWSER_CORE_SRC } from "./browserCore";
import { BypassResult, SiteHandler } from "./types";

// A default handler timeout — how long we're willing to click/wait before
// giving up and telling the user we couldn't bypass this link.
const DEFAULT_TIMEOUT_MS = 25_000;

// "settle" window: once the URL changes, we wait this long with NO further
// change before we trust it's the real final destination (pages sometimes
// bounce through 2-3 intermediate redirects).
const SETTLE_MS = 1_200;
const POLL_MS = 300;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// The main exported function. Notice the return type: Promise<BypassResult>
// — callers (the Telegram bot) always get a predictable shape back, success
// or failure, never a thrown exception for "normal" failure modes.
export async function bypassSite(
  startUrl: string,
  handler: SiteHandler
): Promise<BypassResult> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });

    // Bake the handler config into the injected script as JSON, then call
    // window.__adskipperStart(handler) — this all runs before the page's
    // own scripts get a chance to, matching @run-at document-start.
    const initScript = `${BROWSER_CORE_SRC}
      window.__adskipperStart(${JSON.stringify(handler)});
    `;
    await context.addInitScript({ content: initScript });

    const page = await context.newPage();

    const startHost = hostnameOf(startUrl);
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });

    const timeoutMs = handler.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;

    let lastUrl = page.url();
    let stableSince = Date.now();
    let hops = 0;

    // Poll loop: TS narrows `page.url()` to `string` automatically here,
    // no annotation needed — inference does the work.
    while (Date.now() < deadline) {
      await page.waitForTimeout(POLL_MS);
      const currentUrl = page.url();

      if (currentUrl !== lastUrl) {
        hops++;
        lastUrl = currentUrl;
        stableSince = Date.now();
        continue;
      }

      const movedOffStart = hostnameOf(currentUrl) !== startHost;
      const settled = Date.now() - stableSince >= SETTLE_MS;

      if (movedOffStart && settled) {
        return { success: true, finalUrl: currentUrl, hops };
      }
    }

    return {
      success: false,
      error: "Timed out before the page settled on a final URL",
      hops,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  } finally {
    // `finally` guarantees the browser closes even if something above threw
    // — otherwise headless Chromium instances pile up and eat Render's RAM.
    await browser.close();
  }
}

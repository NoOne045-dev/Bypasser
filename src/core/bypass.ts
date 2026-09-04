import { chromium, type BrowserContext, type Page } from "playwright";
import { BROWSER_CORE_SRC } from "./browserCore";
import { BypassResult, SiteHandler } from "./types";

const DEFAULT_TIMEOUT_MS = 40_000;

// Settle on hostname + pathname (not the full URL). Ad/analytics scripts
// mutate query strings forever, which is what used to trip
// "Timed out before the page settled on a final URL".
const SETTLE_MS = 1_500;
const POLL_MS = 300;

const AD_BLOCK =
  /doubleclick|googlesyndication|adservice|adsystem|facebook\.net|hotjar|scorecardresearch|taboola|outbrain|popads|popcash|propellerads/i;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function navKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.pathname}`;
  } catch {
    return url;
  }
}

function isOnHandlerHost(url: string, handler: SiteHandler): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  return handler.hosts.some(
    (h) => h !== "*" && (host === h || host.endsWith("." + h))
  );
}

function isUsableUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) && url !== "about:blank";
}

async function attachAdBlock(context: BrowserContext): Promise<void> {
  await context.route("**/*", (route) => {
    const reqUrl = route.request().url();
    if (AD_BLOCK.test(reqUrl)) {
      return route.abort();
    }
    return route.continue();
  });
}

async function extractDestination(
  page: Page,
  handler: SiteHandler
): Promise<string | undefined> {
  try {
    const found = await page.evaluate(() => {
      const hints = [
        "get link",
        "continue",
        "skip",
        "destination",
        "go to",
        "proceed",
        "visit",
      ];
      const nodes = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("a[href]")
      );
      const scored = nodes
        .map((a) => {
          const href = a.href || "";
          const text = (a.textContent || a.getAttribute("value") || "")
            .trim()
            .toLowerCase();
          const cls = (a.className || "").toLowerCase();
          let score = 0;
          if (cls.includes("get-link") || cls.includes("skip")) score += 5;
          if (hints.some((h) => text.includes(h))) score += 3;
          if (a.id && /link|skip|continue|dest/i.test(a.id)) score += 2;
          return { href, score };
        })
        .filter((x) => /^https?:\/\//i.test(x.href))
        .sort((a, b) => b.score - a.score);
      return scored[0]?.href as string | undefined;
    });
    if (found && isUsableUrl(found) && !isOnHandlerHost(found, handler)) {
      return found;
    }
  } catch {
    // page may have navigated away mid-evaluate
  }
  return undefined;
}

function pickBestOffsite(urls: string[], handler: SiteHandler, startUrl: string) {
  for (let i = urls.length - 1; i >= 0; i--) {
    const u = urls[i];
    if (isUsableUrl(u) && !isOnHandlerHost(u, handler) && navKey(u) !== navKey(startUrl)) {
      return u;
    }
  }
  return undefined;
}

export async function bypassSite(
  startUrl: string,
  handler: SiteHandler
): Promise<BypassResult> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ignoreHTTPSErrors: true,
    });

    await attachAdBlock(context);

    const initScript = `${BROWSER_CORE_SRC}
      window.__adskipperStart(${JSON.stringify(handler)});
    `;
    await context.addInitScript({ content: initScript });

    const seen: string[] = [];
    const remember = (url: string) => {
      if (isUsableUrl(url) && seen[seen.length - 1] !== url) seen.push(url);
    };

    context.on("page", (p) => {
      remember(p.url());
      p.on("framenavigated", (frame) => {
        if

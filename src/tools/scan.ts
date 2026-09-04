import { chromium } from "playwright";

// Extend this list with any candidate shortener you're curious about —
// nothing here is hardcoded elsewhere in the app, this file is standalone.
const CANDIDATES: string[] = [
  "https://linkpoi.in",
  "https://exe.io",
  "https://gplinks.in",
  "https://shrinkme.io",
  "https://droplink.co",
  "https://mboost.me",
  "https://ouo.io",
  "https://linkvertise.com",
  "https://adfoc.us",
  "https://shorte.st",
];

// A `type` here (rather than `interface`) because it's a closed set of
// string literals — a "union type". TS will yell if you typo one of these
// anywhere else in the file.
type ProtectionLevel = "none" | "cloudflare" | "hcaptcha" | "recaptcha" | "unknown/error";

interface ScanResult {
  url: string;
  level: ProtectionLevel;
  title: string;
  detail: string;
}

async function classify(url: string): Promise<ScanResult> {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1500); // let challenge scripts inject, if any

    const html = (await page.content()).toLowerCase();
    const title = await page.title();

    let level: ProtectionLevel = "none";
    let detail = "no known challenge markers found";

    if (html.includes("hcaptcha.com")) {
      level = "hcaptcha";
      detail = "hcaptcha.com script/iframe present";
    } else if (
      html.includes("challenges.cloudflare.com") ||
      html.includes("cf-challenge") ||
      title.toLowerCase().includes("just a moment")
    ) {
      level = "cloudflare";
      detail = "Cloudflare challenge markers present";
    } else if (html.includes("recaptcha")) {
      level = "recaptcha";
      detail = "reCAPTCHA script present";
    }

    return { url, level, title, detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { url, level: "unknown/error", title: "-", detail: message };
  } finally {
    await browser.close();
  }
}

// Rank easiest -> hardest so the printed report is already sorted for you.
const DIFFICULTY_ORDER: Record<ProtectionLevel, number> = {
  none: 0,
  recaptcha: 1,
  cloudflare: 2,
  hcaptcha: 3,
  "unknown/error": 4,
};

async function main() {
  console.log(`Scanning ${CANDIDATES.length} sites...\n`);

  // Promise.allSettled (not Promise.all) so one failing site doesn't kill
  // the whole batch — every promise "settles" (fulfilled or rejected) and
  // we get a result for each regardless.
  const settled = await Promise.allSettled(CANDIDATES.map(classify));

  const results: ScanResult[] = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : { url: CANDIDATES[i], level: "unknown/error", title: "-", detail: String(s.reason) }
  );

  results.sort((a, b) => DIFFICULTY_ORDER[a.level] - DIFFICULTY_ORDER[b.level]);

  console.log("difficulty  level        site                     notes");
  console.log("----------  -----------  -----------------------  ----------------------------");
  results.forEach((r) => {
    const rank = DIFFICULTY_ORDER[r.level];
    console.log(
      `${rank}           ${r.level.padEnd(12)} ${r.url.padEnd(24)} ${r.detail}`
    );
  });
}

main();

import { SiteHandler } from "../core/types";

// exe.io redirects through a white-label domain (exeygo.com) — both need
// to be listed or the dispatcher won't match links that land there.
//
// Note: this site has Cloudflare Turnstile enabled (confirmed via its own
// app_vars config: captcha_type "turnstile"). We are NOT attempting to
// solve it — isProtectedPage() in browserCore.ts already pauses all
// clicking while a challenge is visible, same as every other handler.
// If Turnstile resolves invisibly (common for real browser engines) this
// proceeds normally; if it doesn't, bypassSite() times out and reports
// failure rather than doing anything forceful.
export const exeIoHandler = {
  tag: "exe.io",
  hosts: ["exe.io", "exeygo.com"],
  selectors: [
    'button.link-button[data-ref="continue"]', // stage 1: "Continue"
  ],
  textHints: [
    "continue", // backup match by text, in case the selector above changes
    "get link", // stage 2: appears after a ~6s countdown
    "skip ad",
  ],
  timerSpeedup: true,
  eventBurst: false,
} satisfies SiteHandler;

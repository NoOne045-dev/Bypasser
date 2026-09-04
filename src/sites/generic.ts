import { SiteHandler } from "../core/types";

// Fallback when no per-site file matches. Clicks the usual "get link /
// continue / skip ad" controls and speeds up countdowns. Hosts: ["*"] is
// a sentinel — findHandler treats this as "match anything leftover".
export const genericHandler = {
  tag: "generic",
  hosts: ["*"],
  selectors: [
    "a.get-link:not(.disabled)",
    "button#showlink",
    "a#showlink",
    "button.link-button[data-ref='continue']",
    "a#skip",
    "button#skip",
    "a.btn.btn-primary",
    "button.btn-success",
    "a.skip-btn",
    "button.get-link",
  ],
  textHints: [
    "get link",
    "continue",
    "proceed",
    "go to link",
    "skip ad",
    "skip",
    "visit link",
    "go to destination",
  ],
  timerSpeedup: true,
  eventBurst: false,
  timeoutMs: 40_000,
} satisfies SiteHandler;

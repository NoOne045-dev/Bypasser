import { SiteHandler } from "../core/types";

// `satisfies SiteHandler` (instead of `: SiteHandler`) checks this object
// against the interface WITHOUT widening its type — so autocomplete below
// still knows the exact literal values, not just "string[]". Small TS
// trick, worth knowing.
export const linkpoiHandler = {
  tag: "linkpoi.in",
  hosts: ["linkpoi.in"],
  selectors: [
    "a.get-link:not(.disabled)",
    "button#showlink",
    "a#showlink",
    "a.btn.btn-primary",
    "button.btn-success",
  ],
  textHints: ["get link", "continue", "proceed", "go to link"],
  timerSpeedup: true,
  eventBurst: false,
} satisfies SiteHandler;

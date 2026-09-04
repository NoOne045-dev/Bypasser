// `interface` (vs `type`) is the idiomatic choice for "shape of an object
// that other files will implement/extend". Functionally very similar to
// `type` here, but interfaces read a bit better for config objects like this.
export interface SiteHandler {
  /** short id used in logs, e.g. "linkpoi.in" */
  readonly tag: string;

  /** hostnames this handler applies to, e.g. ["linkpoi.in"] */
  readonly hosts: string[];

  /** CSS selectors to auto-click, in priority order (from your userscript) */
  readonly selectors: string[];

  /** button/link text to auto-click by content match (case-insensitive) */
  readonly textHints: string[];

  /** whether to accelerate setTimeout/setInterval countdowns */
  readonly timerSpeedup: boolean;

  /** use a synthetic mouse-event burst instead of el.click() */
  readonly eventBurst: boolean;

  /** how long (ms) to keep clicking/watching before giving up */
  readonly timeoutMs?: number;
}

export interface BypassResult {
  success: boolean;
  url?: string;
  finalUrl?: string; // Kept as optional for backward compatibility if referenced elsewhere
  error?: string;
  /** how many hops the browser navigated through before settling */
  hops?: number;
}

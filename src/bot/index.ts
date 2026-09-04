import { SiteHandler } from "../core/types";
import { linkpoiHandler } from "./linkpoi.in";
import { exeIoHandler } from "./exe.io";

// A registry array. To add your next site, write a new `*.ts` file like
// linkpoi.in.ts, import it here, and push it into this list — nothing
// else in the codebase needs to change. That's the whole point of this
// pattern (it's basically the plugin/strategy design pattern).
const HANDLERS: SiteHandler[] = [linkpoiHandler, exeIoHandler];

export function findHandler(url: string): SiteHandler | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }

  // .find() returns the first match or `undefined` — TS models "might not
  // exist" with `| undefined`, which is why the return type below is
  // `SiteHandler | null` and we convert undefined -> null explicitly.
  const match = HANDLERS.find((h) =>
    h.hosts.some((host) => hostname === host || hostname.endsWith("." + host))
  );

  return match ?? null;
}

export function supportedSites(): string[] {
  return HANDLERS.flatMap((h) => h.hosts);
}

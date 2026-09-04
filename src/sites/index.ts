import { SiteHandler } from "../core/types";
import { linkpoiHandler } from "./linkpoi.in";
import { exeIoHandler } from "./exe.io";
import { genericHandler } from "./generic";

const HANDLERS: SiteHandler[] = [linkpoiHandler, exeIoHandler];

export function findHandler(url: string): SiteHandler | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }

  const match = HANDLERS.find((h) =>
    h.hosts.some((host) => hostname === host || hostname.endsWith("." + host))
  );

  // Unknown host → generic click/timer fallback, not a hard reject.
  return match ?? genericHandler;
}

export function supportedSites(): string[] {
  return HANDLERS.flatMap((h) => h.hosts);
}

export { genericHandler };

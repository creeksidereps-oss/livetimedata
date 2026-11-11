// src/lib/events/crawl/fetch.ts
//
// The crawler's single fetch layer.
//   - Realistic browser headers, redirects followed.
//   - Retries with backoff on 429 / 5xx / network errors (honours Retry-After), and one retry with a
//     plain header set on 403 / 406 (some servers reject the full browser header set).
//   - Every fetch returns WHY it failed (fetch_status), so problem sources sort themselves into queues.
//   - Successful HTML that is only a JavaScript application shell is reported as `js_shell`.
//
// $0: plain HTTP. No headless browser, no paid APIs.

export type FetchStatus = "ok" | "waf_blocked" | "not_found" | "timeout" | "network" | "http_error" | "js_shell";

export interface FetchResult {
  status: FetchStatus;
  httpStatus?: number;
  body?: string;
  finalUrl?: string;
  contentType?: string;
  detail?: string;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Sec-Ch-Ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
};

const PLAIN_HEADERS: Record<string, string> = { "User-Agent": UA, Accept: "*/*", "Accept-Language": "en-US,en;q=0.9" };

const MAX_RETRIES = 2;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Cloudflare / Akamai / Sucuri / Imperva / generic bot-challenge markers. */
export function isWafResponse(httpStatus: number, headers: Headers | Record<string, string>, body: string): boolean {
  const get = (k: string) => (headers instanceof Headers ? headers.get(k) : (headers as Record<string, string>)[k]) || "";
  if (![401, 403, 406, 429, 503].includes(httpStatus)) return false;
  const server = `${get("server")} ${get("cf-ray") ? "cloudflare" : ""} ${get("x-sucuri-id") ? "sucuri" : ""} ${get("x-iinfo") ? "imperva" : ""}`.toLowerCase();
  if (/cloudflare|akamai|sucuri|imperva|incapsula|ddos-guard|awselb/.test(server)) return true;
  return /cf-browser-verification|challenge-platform|just a moment|attention required|access denied|request unsuccessful|incapsula|captcha|bot detection|are you a robot/i.test(body.slice(0, 20000));
}

/** Visible text length of an HTML document (scripts / styles / tags removed). */
export function visibleTextLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/**
 * A JavaScript application shell: almost no visible text, an empty app root, no structured events.
 * (Angular / React / Vue / ASP.NET SPA pages whose content is rendered in the browser.)
 */
export function isJsShell(html: string): boolean {
  if (/application\/ld\+json/i.test(html) && /"@type"\s*:\s*"[A-Za-z]*Event"/.test(html)) return false;
  const text = visibleTextLength(html);
  if (text > 600) return false;
  return /<div[^>]+id=["'](root|app|__next|__nuxt|main-app)["'][^>]*>\s*<\/div>|ng-version=|<app-root|data-reactroot|window\.__INITIAL_STATE__|<noscript>[^<]*enable javascript/i.test(html) || text < 200;
}

/**
 * Fetch one URL. Never throws; the result says what happened.
 * `kind: "page"` runs JS-shell detection on HTML; `kind: "data"` (JSON / iCal) does not.
 */
export async function fetchPage(
  url: string,
  opts: { timeoutMs?: number; accept?: string; kind?: "page" | "data"; retries?: number } = {}
): Promise<FetchResult> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const kind = opts.kind ?? "page";
  const maxRetries = opts.retries ?? MAX_RETRIES;
  let headers = { ...BROWSER_HEADERS, ...(opts.accept ? { Accept: opts.accept } : {}) };
  if (kind === "data") headers = { ...PLAIN_HEADERS, ...(opts.accept ? { Accept: opts.accept } : {}) };
  let triedPlain = kind === "data";
  let last: FetchResult = { status: "network", detail: "not attempted" };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
      const body = await res.text();
      const contentType = res.headers.get("content-type") || "";
      if (res.ok) {
        if (kind === "page" && /html/i.test(contentType) && isJsShell(body)) {
          return { status: "js_shell", httpStatus: res.status, body, finalUrl: res.url, contentType, detail: "page is a JavaScript application shell" };
        }
        return { status: "ok", httpStatus: res.status, body, finalUrl: res.url, contentType };
      }
      if (res.status === 404 || res.status === 410) return { status: "not_found", httpStatus: res.status, finalUrl: res.url, detail: `HTTP ${res.status}` };
      const waf = isWafResponse(res.status, res.headers, body);
      last = { status: waf ? "waf_blocked" : "http_error", httpStatus: res.status, finalUrl: res.url, detail: `HTTP ${res.status}${waf ? " (bot protection)" : ""}` };
      // 403 / 406: one more try with a plain header set (some servers reject the browser header set).
      if ((res.status === 403 || res.status === 406) && !triedPlain) {
        triedPlain = true;
        headers = { ...PLAIN_HEADERS, ...(opts.accept ? { Accept: opts.accept } : {}) };
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        const ra = parseInt(res.headers.get("retry-after") || "", 10);
        if (attempt < maxRetries) await sleep(Number.isFinite(ra) && ra > 0 && ra <= 20 ? ra * 1000 : 1500 * (attempt + 1));
        continue;
      }
      return last;
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError" || /timeout|aborted/i.test(msg);
      last = { status: isTimeout ? "timeout" : "network", detail: (err?.cause?.code ? `${err.cause.code}: ` : "") + msg.slice(0, 300) };
      if (attempt < maxRetries) await sleep(1500 * (attempt + 1));
    }
  }
  return last;
}

/** JSON helper on top of fetchPage (null on any failure). */
export async function fetchJsonData(url: string, timeoutMs = 12000): Promise<any | null> {
  const r = await fetchPage(url, { timeoutMs, accept: "application/json", kind: "data" });
  if (r.status !== "ok" || !r.body) return null;
  try {
    return JSON.parse(r.body);
  } catch {
    return null;
  }
}

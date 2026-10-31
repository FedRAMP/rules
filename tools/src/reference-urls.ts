import { loadRulesDocument } from "./rules";
import type { ConsistencyIssue } from "./consistency";

export interface ReferenceUrlTarget {
  location: string;
  url: string;
}

type FetchUrl = (url: string, init: RequestInit) => Promise<Response>;

// Only reference URL fields are in scope, including the legacy FRD spelling.
// Notification targets, schema URLs, and URLs embedded in prose are separate.
export function collectReferenceUrls(document: unknown): ReferenceUrlTarget[] {
  const targets: ReferenceUrlTarget[] = [];
  function visit(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else if (value !== null && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        const location = path ? `${path}.${key}` : key;
        if (
          (key === "reference_url" || key === "referenceurl") &&
          typeof child === "string"
        ) {
          targets.push({ location, url: child });
        } else {
          visit(child, location);
        }
      }
    }
  }
  visit(document, "");
  return targets;
}

async function checkUrl(
  url: string,
  fetchUrl: FetchUrl,
  timeoutMs: number,
): Promise<string | null> {
  // A single deadline bounds both requests, including redirects. A failed HEAD
  // gets a GET fallback because some sites reject HEAD but serve the resource.
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    let response = await fetchUrl(url, {
      method: "HEAD",
      redirect: "follow",
      signal,
    });
    await response.body?.cancel();
    if (!response.ok) {
      response = await fetchUrl(url, {
        method: "GET",
        redirect: "follow",
        signal,
      });
      await response.body?.cancel();
    }
    if (response.ok) return null;
    const destination =
      response.url && response.url !== url ? ` at ${response.url}` : "";
    const detail =
      response.status === 401 || response.status === 403
        ? "access denied; reachability could not be verified"
        : response.status === 429
          ? "rate limited; reachability could not be verified"
          : "reference did not return a successful response";
    return `HTTP ${response.status}${destination}: ${detail}.`;
  } catch (error) {
    if (signal.aborted)
      return `Timed out after ${timeoutMs} ms; reachability could not be verified.`;
    return `Request failed: ${error instanceof Error ? error.message : String(error)}; reachability could not be verified.`;
  }
}

export async function collectReferenceUrlIssues(
  document: unknown,
  options: { fetchUrl?: FetchUrl; timeoutMs?: number } = {},
): Promise<ConsistencyIssue[]> {
  const targets = collectReferenceUrls(document);
  const groups = new Map<string, ReferenceUrlTarget[]>();
  const results = new Map<string, string>();
  for (const target of targets) {
    try {
      const url = new URL(target.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        results.set(
          target.location,
          `Unsupported reference URL protocol ${url.protocol}; expected HTTP or HTTPS.`,
        );
        continue;
      }
      // HTTP requests cannot verify document fragment anchors.
      url.hash = "";
      const key = url.href;
      const group = groups.get(key) ?? [];
      group.push(target);
      groups.set(key, group);
    } catch {
      results.set(target.location, "Invalid absolute reference URL.");
    }
  }

  const pending = [...groups.entries()];
  let next = 0;
  const worker = async () => {
    while (next < pending.length) {
      const [url, locations] = pending[next++]!;
      const message = await checkUrl(
        url,
        options.fetchUrl ?? fetch,
        options.timeoutMs ?? 10_000,
      );
      if (message)
        for (const target of locations) results.set(target.location, message);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(4, pending.length) }, worker),
  );

  // Report in document order even when requests complete out of order.
  return targets.flatMap(({ location, url }) => {
    const message = results.get(location);
    return message ? [{ location, message: `${url}\n    ${message}` }] : [];
  });
}

export function formatReferenceUrlReport(issues: ConsistencyIssue[]): string {
  return [
    `Reference URL validation failed with ${issues.length} issue${issues.length === 1 ? "" : "s"}:`,
    ...issues.map(
      ({ location, message }) => `\n  - ${location}\n    ${message}`,
    ),
  ].join("\n");
}

if (import.meta.main) {
  const issues = await collectReferenceUrlIssues(loadRulesDocument());
  if (issues.length > 0) {
    console.error(formatReferenceUrlReport(issues));
    process.exit(1);
  }
  console.log("Reference URL validation passed.");
}
